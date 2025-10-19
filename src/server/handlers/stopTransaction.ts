import { StopTransactionRequest } from '../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../types/1.6/StopTransactionResponse';
import { AppDataSource } from '../../db/postgres'
import { Transaction } from '../../db/entities/Transaction';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
    try {
        logger.info(`[StopTransaction] Processing request: transactionId=${req.transactionId}, type=${typeof req.transactionId}`);
        logger.info(`[StopTransaction] Full request object: ${JSON.stringify(req)}`);
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';  // Реальная проверка авторизации по idTag — опционально
        const repo = AppDataSource.getRepository(Transaction);

        // Ищем существующую транзакцию по ID
        logger.info(`[StopTransaction] About to find transaction with id: ${req.transactionId}, type: ${typeof req.transactionId}`);
        const tx = await repo.findOneBy({ id: req.transactionId.toString() });
        if (!tx) {
            logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        // Расчёт метрик
        const totalWh = (req.meterStop ?? 0) - (tx.meterStart ?? 0);
        const totalKWh = totalWh / 1000;
        const tariff = 0.1; // Тариф, можно взять из tx/tariff или конфига
        const cost = totalKWh * tariff;
        const sessionDurationMinutes = (new Date(req.timestamp).getTime() - tx.startTime.getTime()) / (1000 * 60);
        const maxPossibleKWh = Math.max(sessionDurationMinutes * 0.05, 0);  // Пример: 3 kW = 0.05 kWh/min
        let efficiencyPercentage = maxPossibleKWh > 0 ? (totalKWh / maxPossibleKWh) * 100 : 0;
        if (!Number.isFinite(efficiencyPercentage)) efficiencyPercentage = 0;
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

        logger.info(`[StopTransaction] About to save tx with values: totalKWh=${totalKWh}, cost=${cost}, efficiencyPercentage=${efficiencyPercentage}`);
        await repo.save(tx);

        logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${tx.connectorId}`);

        // Обновление состояния коннектора
        // После сохранения транзакции:
        const connectorId = tx.connectorId;
        if (!connectorId) {
            logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        const currentState = connectionManager.getConnectorState(chargePointId, connectorId);
        if (currentState && currentState.status !== 'Charging') {
            logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId}`);
        }

        connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');

        // Дополняем существующую транзакцию данными остановки
        connectionManager.addRecentTransaction({
            transactionId: req.transactionId,
            chargePointId,
            connectorId,
            idTag: req.idTag || tx.idTag,
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            reason: req.reason,
            totalKWh,
            cost,
            efficiencyPercentage,
            status: 'Stopped'
        });

        // Таймаут сброса коннектора
        setTimeout(() => {
            connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available`);
        }, 2000);

        return { idTagInfo: { status: idTagStatus } };
    } catch (err) {
        logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}