import { StopTransactionRequest } from '../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../types/1.6/StopTransactionResponse';
import { Transaction } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
    try {
        // Проверка авторизации ID-тега (опционально; стандарт OCPP)
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';

        const tx = await Transaction.findOneAndUpdate(
            { id: req.transactionId.toString() },  // Приводим к строке, если модель ожидает string
            {
                stopTime: new Date(req.timestamp),
                meterStop: req.meterStop,
                reason: req.reason,  // Опциональное
                transactionData: req.transactionData || [],  // Опциональное, с дефолтом
                idTag: req.idTag || null  // Опциональное, для записи ID-тега остановки
            },
            { new: true }
        );

        if (!tx) {
            logger.error(`[StopTransaction] Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        await Log.create({ action: 'StopTransaction', chargePointId, payload: req });

        // Обновляем состояние коннектора: извлекаем connectorId из найденной транзакции
        const connectorId = tx.connectorId;  // Из модели Transaction (сохранено в StartTransaction)
        if (!connectorId) {
            logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        // Проверяем текущее состояние коннектора (опционально, для безопасности)
        const currentState = connectionManager.getConnectorState(chargePointId, connectorId);
        if (currentState && currentState.status !== 'Charging') {
            logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId}`);
        }

        connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');

        logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);

        // Индивидуальный таймаут: Сброс только этого коннектора в 'Available' через 2 секунды
        setTimeout(() => {
            connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available after Finishing`);
        }, 2000);  // Стандартный таймаут по OCPP (1–5 секунд)

        return { idTagInfo: { status: idTagStatus } };
    } catch (err) {
        logger.error(`[StopTransaction] Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}