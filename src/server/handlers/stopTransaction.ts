import { StopTransactionRequest } from '../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../types/1.6/StopTransactionResponse';
import { AppDataSource } from '../../db/postgres'
import { Transaction } from '../../db/entities/Transaction';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
    logger.info(`[StopTransaction] ===== START ===== chargePointId=${chargePointId}`);
    try {
        logger.info(`[StopTransaction] Processing request: transactionId=${req.transactionId}, type=${typeof req.transactionId}`);
        logger.info(`[StopTransaction] Full request object: ${JSON.stringify(req)}`);
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';

        // Find transaction in PostgreSQL
        const repo = AppDataSource.getRepository(Transaction);
        const tx = await repo.findOneBy({ id: req.transactionId.toString() });
        if (!tx) {
            logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            logger.info(`[StopTransaction] ===== END (tx not found) =====`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        logger.info(`[StopTransaction] Found tx: id=${tx.id}, connectorId=${tx.connectorId}, chargePointId=${tx.chargePointId}`);

        // Расчёт метрик
        const totalWh = (req.meterStop ?? 0) - (tx.meterStart ?? 0);
        const totalKWh = totalWh / 1000;
        const tariff = 0.1;
        const cost = totalKWh * tariff;
        const sessionDurationMinutes = (new Date(req.timestamp).getTime() - tx.startTime.getTime()) / (1000 * 60);
        const maxPossibleKWh = Math.max(sessionDurationMinutes * 0.05, 0);
        let efficiencyPercentage = maxPossibleKWh > 0 ? (totalKWh / maxPossibleKWh) * 100 : 0;
        if (!Number.isFinite(efficiencyPercentage)) efficiencyPercentage = 0;
        efficiencyPercentage = Math.max(0, Math.min(100, efficiencyPercentage));

        logger.info(`[StopTransaction] Metrics: totalWh=${totalWh}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)}, efficiency=${efficiencyPercentage.toFixed(1)}%`);

        // Update transaction in PostgreSQL
        tx.stopTime = new Date(req.timestamp);
        tx.meterStop = req.meterStop;
        tx.reason = req.reason;
        tx.transactionData = req.transactionData || [];
        tx.idTag = req.idTag || tx.idTag;
        tx.totalKWh = Math.round(totalWh);
        tx.cost = Math.round(cost * 10000);
        tx.efficiencyPercentage = Math.round(efficiencyPercentage);
        await repo.save(tx);
        logger.info(`[StopTransaction] Transaction ${req.transactionId} saved to PostgreSQL`);

        logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${tx.connectorId}`);

        // Обновление состояния коннектора
        // После сохранения транзакции:
        const connectorId = tx.connectorId;
        if (!connectorId) {
            logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            logger.info(`[StopTransaction] ===== END (no connectorId) =====`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        const currentState = connectionManager.getConnectorState(chargePointId, connectorId);
        logger.info(`[StopTransaction] Current connector ${connectorId} state: ${currentState?.status || 'unknown'}`);

        if (currentState && currentState.status !== 'Charging') {
            logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId} (current status: ${currentState.status})`);
        }

        connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        logger.info(`[StopTransaction] Set connector ${connectorId} to Finishing state`);

        // 🔥 Добавляем ПОЛНУЮ транзакцию в recentTransactions (start + stop данные)
        connectionManager.addRecentTransaction({
            transactionId: req.transactionId,
            chargePointId,
            connectorId,
            idTag: req.idTag || 'unknown',
            // START данные из мока:
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
            connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available`);
            connectionManager.broadcastEvent('connector.status.changed', { stationId: chargePointId, connectorId, status: 'Available' });
        }, 2000);

        connectionManager.broadcastEvent('transaction.stopped', {
            stationId: chargePointId,
            connectorId,
            transactionId: req.transactionId,
            stopTime: new Date(req.timestamp).toISOString(),
            totalKWh,
            cost,
            efficiencyPercentage
        });

        logger.info(`[StopTransaction] ===== END (success) ===== transactionId=${req.transactionId}, connector=${connectorId}`);
        return { idTagInfo: { status: idTagStatus } };
    } catch (err) {
        logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        logger.info(`[StopTransaction] ===== END (error) =====`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}