"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const postgres_1 = require("../../db/postgres");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStopTransaction(req, chargePointId, ws) {
    logger_1.logger.info(`[StopTransaction] ===== START ===== chargePointId=${chargePointId}`);
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
            logger_1.logger.info(`[StopTransaction] ===== END (tx not found) =====`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        logger_1.logger.info(`[StopTransaction] Found tx: id=${tx.id}, connectorId=${tx.connectorId}, chargePointId=${tx.chargePointId}`);
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
        logger_1.logger.info(`[StopTransaction] Metrics: totalWh=${totalWh}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)}, efficiency=${efficiencyPercentage.toFixed(1)}%`);
        // Обновляем транзакцию
        tx.stopTime = new Date(req.timestamp);
        tx.meterStop = req.meterStop;
        tx.reason = req.reason;
        tx.transactionData = req.transactionData || [];
        tx.idTag = req.idTag || tx.idTag;
        // ВРЕМЕННОЕ РЕШЕНИЕ: храним как целые числа (Wh * 1000 для totalKWh, центы * 100 для cost)
        tx.totalKWh = Math.round(totalWh); // Храним в Wh как integer
        tx.cost = Math.round(cost * 10000); // Храним в 1/10000 EUR как integer
        tx.efficiencyPercentage = Math.round(efficiencyPercentage);
        logger_1.logger.info(`[StopTransaction] About to save tx with values: totalKWh=${totalKWh}, cost=${cost}, efficiencyPercentage=${efficiencyPercentage}`);
        await repo.save(tx);
        logger_1.logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${tx.connectorId}`);
        // Обновление состояния коннектора
        // После сохранения транзакции:
        const connectorId = tx.connectorId;
        if (!connectorId) {
            logger_1.logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            logger_1.logger.info(`[StopTransaction] ===== END (no connectorId) =====`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        const currentState = index_1.connectionManager.getConnectorState(chargePointId, connectorId);
        logger_1.logger.info(`[StopTransaction] Current connector ${connectorId} state: ${currentState?.status || 'unknown'}`);
        if (currentState && currentState.status !== 'Charging') {
            logger_1.logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId} (current status: ${currentState.status})`);
        }
        index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        logger_1.logger.info(`[StopTransaction] Set connector ${connectorId} to Finishing state`);
        // 🔥 Добавляем ПОЛНУЮ транзакцию в recentTransactions (start + stop данные)
        index_1.connectionManager.addRecentTransaction({
            transactionId: req.transactionId,
            chargePointId,
            connectorId,
            idTag: req.idTag || tx.idTag,
            // START данные из БД:
            startTime: tx.startTime,
            meterStart: tx.meterStart,
            // STOP данные:
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            reason: req.reason,
            totalKWh,
            cost,
            efficiencyPercentage,
            status: 'Completed'
        });
        // Таймаут сброса коннектора
        setTimeout(() => {
            index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger_1.logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available`);
        }, 2000);
        logger_1.logger.info(`[StopTransaction] ===== END (success) ===== transactionId=${req.transactionId}, connector=${connectorId}`);
        return { idTagInfo: { status: idTagStatus } };
    }
    catch (err) {
        logger_1.logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        logger_1.logger.info(`[StopTransaction] ===== END (error) =====`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
