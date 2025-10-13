"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStartTransaction = handleStartTransaction;
const Transaction_1 = require("../../db/entities/Transaction");
const postgres_1 = require("../../db/postgres");
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStartTransaction(req, chargePointId, ws) {
    const transId = Date.now().toString(); // Генерация строкового ID
    try {
        // postgres
        const idTagStatus = 'Accepted'; // Замените на реальную проверку
        const repo = postgres_1.AppDataSource.getRepository(Transaction_1.Transaction);
        const newTx = repo.create({
            id: transId,
            chargePointId,
            connectorId: req.connectorId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            meterStart: req.meterStart,
        });
        await repo.save(newTx);
        // postgres
        await mongoose_1.Log.create({ action: 'StartTransaction', chargePointId, payload: req });
        const limitType = req.limitType || 'full'; // 'percentage', 'amount', 'full'
        const limitValue = req.limitValue || 100; // Из запроса
        const tariffPerKWh = req.tariffPerKWh || 0.1;
        const batteryCapacityKWh = 60; // Из конфигурации ChargePoint
        const session = new mongoose_2.ChargingSession({
            id: `session-${transId}`,
            chargePointId,
            connectorId: req.connectorId,
            transactionId: transId.toString(),
            limitType,
            limitValue,
            tariffPerKWh,
            batteryCapacityKWh,
            startTime: new Date(req.timestamp),
            status: 'active'
        });
        await session.save();
        // Формируем ответ (transactionId как number)
        const response = {
            transactionId: transId, // Теперь соответствует типу number
            idTagInfo: {
                status: idTagStatus // 'Accepted' или 'Blocked'
            }
        };
        logger_1.logger.info(`[StartTransaction] Started session with limits: type=${limitType}, value=${limitValue}, tariff=${tariffPerKWh}`);
        logger_1.logger.info(`[StartTransaction] Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);
        // Обновляем состояние коннектора
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
