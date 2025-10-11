import { StopTransactionRequest } from '../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../types/1.6/StopTransactionResponse';
import { Transaction } from '../../db/mongoose';
import { ChargingSession } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
    try {
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';  // Замените на реальную проверку

        const tx = await Transaction.findOneAndUpdate(
            { id: req.transactionId.toString() },
            {
                stopTime: new Date(req.timestamp),
                meterStop: req.meterStop,
                reason: req.reason,
                transactionData: req.transactionData || [],
                idTag: req.idTag || null
            },
            { new: true }
        );

        if (!tx) {
            logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        await Log.create({ action: 'StopTransaction', chargePointId, payload: req });

        // Единый расчёт метрик (один раз, после обновления tx)
        const totalWh = (req.meterStop || 0) - (tx.meterStart || 0);  // В Wh (исправлено: вычитание meterStart)
        const totalKWh = totalWh / 1000;
        const tariff = tx.tariffPerKWh || 0.1;
        const cost = totalKWh * tariff;
        const sessionDurationMinutes = (new Date(req.timestamp).getTime() - tx.startTime.getTime()) / (1000 * 60);
        const maxPossibleKWh = sessionDurationMinutes * 0.05;  // 3 kW = 0.05 kWh/min
        const efficiencyPercentage = maxPossibleKWh > 0 ? (totalKWh / maxPossibleKWh) * 100 : 0;

        // Сохраняем метрики в tx (если поля в схеме)
        tx.totalKWh = totalKWh;
        tx.cost = cost;
        tx.efficiencyPercentage = efficiencyPercentage;
        await tx.save();

        // Обновление сессии (если существует) — используем тот же расчёт
        const session = await ChargingSession.findOne({ chargePointId, transactionId: req.transactionId.toString(), status: 'active' });
        if (session) {
            session.currentKWh = totalKWh;  // Финальный (исправлено: полный расчёт)
            session.status = 'completed';
            await session.save();
            logger.info(`[StopTransaction] Session completed: totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)}`);
        }

        await Log.create({
            action: 'StopTransaction',
            chargePointId,
            payload: { ...req, metrics: { totalKWh, cost, efficiencyPercentage } }
        });

        // Обновление состояния коннектора
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

        // Таймаут сброса только для этого коннектора
        setTimeout(() => {
            connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available`);
        }, 2000);

        logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);

        return { idTagInfo: { status: idTagStatus } };
    } catch (err) {
        logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}