"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStopTransaction(req, chargePointId, ws) {
    try {
        // Проверка авторизации ID-тега (опционально; стандарт OCPP)
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';
        const tx = await mongoose_1.Transaction.findOneAndUpdate({ id: req.transactionId.toString() }, // Приводим к строке, если модель ожидает string
        {
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            reason: req.reason, // Опциональное
            transactionData: req.transactionData || [], // Опциональное, с дефолтом
            idTag: req.idTag || null // Опциональное, для записи ID-тега остановки
        }, { new: true });
        if (!tx) {
            logger_1.logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        await mongoose_2.Log.create({ action: 'StopTransaction', chargePointId, payload: req });
        // Обновляем состояние коннектора: извлекаем connectorId из найденной транзакции
        const connectorId = tx.connectorId; // Из модели Transaction (сохранено в StartTransaction)
        if (!connectorId) {
            logger_1.logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        // Проверяем текущее состояние коннектора (опционально, для безопасности)
        const currentState = index_1.connectionManager.getConnectorState(chargePointId, connectorId);
        if (currentState && currentState.status !== 'Charging') {
            logger_1.logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId}`);
        }
        index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        logger_1.logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);
        // Индивидуальный таймаут: Сброс только этого коннектора в 'Available' через 2 секунды
        setTimeout(() => {
            index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger_1.logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available after Finishing`);
        }, 2000); // Стандартный таймаут по OCPP (1–5 секунд)
        return { idTagInfo: { status: idTagStatus } };
    }
    catch (err) {
        logger_1.logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
