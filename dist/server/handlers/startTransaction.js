"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStartTransaction = handleStartTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
const wsApiHandler_1 = require("../../server/wsApiHandler");
async function handleStartTransaction(req, chargePointId, ws) {
    const transId = Date.now().toString(); // Генерация строкового ID
    try {
        // Generate transaction ID from timestamp (as number for OCPP compatibility)
        // Use seconds instead of milliseconds to avoid int32 overflow (max 2147483647)
        const transId = Math.floor(Date.now() / 1000);
        // 🔥 POSTGRES DISABLED - skip database save
        /* POSTGRES VERSION:
        const idTagStatus = 'Accepted';  // Замените на реальную проверку
        const repo = AppDataSource.getRepository(Transaction);
        const newTx = repo.create({
            id: transId,
            chargePointId,
            connectorId: req.connectorId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            meterStart: req.meterStart,
        });
        await repo.save(newTx)
        */
        logger_1.logger.info(`[StartTransaction] EXPERIMENT: Skipping PostgreSQL save for transaction ${transId}`);
        // postgres
        await mongoose_1.Log.create({ action: 'StartTransaction', chargePointId, payload: req });
        const limitType = req.limitType || 'full'; // 'percentage', 'amount', 'full'
        const limitValue = req.limitValue || 100; // Из запроса
        const tariffPerKWh = req.tariffPerKWh || 0.1;
        const batteryCapacityKWh = 60; // Из конфигурации ChargePoint
        const session = new mongoose_2.ChargingSession({
            id: `session-${transId}`,
            stationId: chargePointId,
            connectorId: req.connectorId,
            transactionId: transId, // Now numeric
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
                status: 'Accepted' // 'Accepted' или 'Blocked'
            }
        };
        logger_1.logger.info(`[StartTransaction] Started session with limits: type=${limitType}, value=${limitValue}, tariff=${tariffPerKWh}`);
        logger_1.logger.info(`[StartTransaction] Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);
        // Обновляем состояние коннектора
        index_1.connectionManager.updateConnectorState(chargePointId, req.connectorId, 'Charging', transId.toString());
        const correlationId = (0, wsApiHandler_1.resolveRemoteStartCorrelation)(chargePointId, req.connectorId, transId.toString());
        index_1.connectionManager.broadcastEvent('transaction.started', {
            stationId: chargePointId,
            connectorId: req.connectorId,
            transactionId: transId, // Send as number for consistency
            idTag: req.idTag,
            startTime: new Date(req.timestamp).toISOString(),
            ...(correlationId ? { correlationId } : {})
        });
        // 🔥 НЕ добавляем в recentTransactions при START
        // Транзакция будет добавлена только при STOP с полными данными
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
