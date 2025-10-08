"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStartTransaction = handleStartTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStartTransaction(req, chargePointId, ws) {
    const transId = Date.now(); // Генерация числового ID (миллисекунды с эпохи — уникально в пределах сессии)
    try {
        // Проверка авторизации ID-тега (стандарт OCPP: если не авторизован, статус 'Blocked')
        // Здесь можно добавить запрос в БД авторизаций (предполагаем, что ID-тег авторизован)
        const idTagStatus = 'Accepted'; // Замените на реальную проверку
        const newTx = new mongoose_1.Transaction({
            id: transId.toString(), // Сохраняем как строку в БД, если модель ожидает string
            chargePointId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            connectorId: req.connectorId,
            meterStart: req.meterStart
        });
        await newTx.save();
        await mongoose_2.Log.create({ action: 'StartTransaction', chargePointId, payload: req });
        // Формируем ответ (transactionId как number)
        const response = {
            transactionId: transId, // Теперь соответствует типу number
            idTagInfo: {
                status: idTagStatus // 'Accepted' или 'Blocked'
            }
        };
        logger_1.logger.info(`Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);
        // Обновляем состояние коннектора (transId как number, но если ConnectorState.transactionId ожидает string, приведите: transId.toString())
        index_1.connectionManager.updateConnectorState(chargePointId, req.connectorId, 'Charging', transId.toString());
        return response;
    }
    catch (err) {
        logger_1.logger.error(`Error in StartTransaction: ${err}`);
        const errorResponse = {
            idTagInfo: { status: 'Invalid' },
            transactionId: transId // Числовой ID даже при ошибке
        };
        return errorResponse;
    }
}
