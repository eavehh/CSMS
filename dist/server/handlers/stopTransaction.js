"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStopTransaction(req, chargePointId, ws) {
    try {
        // Проверка авторизации ID-тега (опционально; стандарт OCPP: если idTag передан и не авторизован, статус 'Blocked')
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted'; // Замените на реальную проверку в БД
        const tx = await mongoose_1.Transaction.findOneAndUpdate({ id: req.transactionId.toString() }, // Приводим к строке, если модель ожидает string
        {
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            reason: req.reason, // Опциональное
            transactionData: req.transactionData || [], // Опциональное, с дефолтом
            idTag: req.idTag || null // Опциональное, для записи ID-тега остановки
        }, { new: true });
        if (!tx) {
            logger_1.logger.error(`Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        await mongoose_2.Log.create({ action: 'StopTransaction', chargePointId, payload: req });
        // Обновляем состояние коннектора: извлекаем connectorId из найденной транзакции
        const connectorId = tx.connectorId; // Из модели Transaction (сохранено в StartTransaction)
        if (!connectorId) {
            logger_1.logger.error(`No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        logger_1.logger.info(`Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);
        // Планируем сброс всех коннекторов в 'Available' через таймаут (стандарт OCPP)
        setTimeout(() => {
            index_1.connectionManager.resetAllConnectorsToAvailable(chargePointId);
        }, 2000); // 2 секунды на Finishing
        return { idTagInfo: { status: idTagStatus } };
    }
    catch (err) {
        logger_1.logger.error(`Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
