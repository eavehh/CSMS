"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const postgres_1 = require("../../db/postgres");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStopTransaction(req, chargePointId, ws) {
    try {
        logger_1.logger.info(`[StopTransaction] Processing request: transactionId=${req.transactionId}, type=${typeof req.transactionId}`);
        logger_1.logger.info(`[StopTransaction] Full request object: ${JSON.stringify(req)}`);
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted'; // Реальная проверка авторизации по idTag — опционально
        const repo = postgres_1.AppDataSource.getRepository(Transaction_1.Transaction);
        // Ищем существующую транзакцию по ID
        logger_1.logger.info(`[StopTransaction] About to find transaction with id: ${req.transactionId}, type: ${typeof req.transactionId}`);
        const tx = await repo.findOneBy({ id: req.transactionId.toString() });
        if (!tx) {
            logger_1.logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        // Расчёт метрик
        const totalWh = (req.meterStop ?? 0) - (tx.meterStart ?? 0);
        const totalKWh = totalWh / 1000;
        const tariff = 0.1; // Тариф, можно взять из tx/tariff или конфига
        const cost = totalKWh * tariff;
        const sessionDurationMinutes = (new Date(req.timestamp).getTime() - tx.startTime.getTime()) / (1000 * 60);
        const maxPossibleKWh = Math.max(sessionDurationMinutes * 0.05, 0); // Пример: 3 kW = 0.05 kWh/min
        let efficiencyPercentage = maxPossibleKWh > 0 ? (totalKWh / maxPossibleKWh) * 100 : 0;
        if (!Number.isFinite(efficiencyPercentage))
            efficiencyPercentage = 0;
        efficiencyPercentage = Math.max(0, Math.min(100, efficiencyPercentage));
        // Обновляем транзакцию
        tx.stopTime = new Date(req.timestamp);
        tx.meterStop = req.meterStop;
        tx.reason = req.reason;
        tx.transactionData = req.transactionData || [];
        tx.idTag = req.idTag || tx.idTag;
        tx.totalKWh = totalKWh;
        tx.cost = cost;
        tx.efficiencyPercentage = efficiencyPercentage;
        logger_1.logger.info(`[StopTransaction] About to save tx with values: totalKWh=${totalKWh}, cost=${cost}, efficiencyPercentage=${efficiencyPercentage}`);
        await repo.save(tx);
        logger_1.logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${tx.connectorId}`);
        // Обновление состояния коннектора
        const connectorId = tx.connectorId;
        if (!connectorId) {
            logger_1.logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        const currentState = index_1.connectionManager.getConnectorState(chargePointId, connectorId);
        if (currentState && currentState.status !== 'Charging') {
            logger_1.logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId}`);
        }
        index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        // Таймаут сброса коннектора
        setTimeout(() => {
            index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger_1.logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available`);
        }, 2000);
        return { idTagInfo: { status: idTagStatus } };
    }
    catch (err) {
        logger_1.logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
