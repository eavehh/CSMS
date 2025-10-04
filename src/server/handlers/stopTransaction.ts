import { StopTransactionRequest } from '../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../types/1.6/StopTransactionResponse';
import { Transaction } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
    try {
        // Проверка авторизации ID-тега (опционально; стандарт OCPP: если idTag передан и не авторизован, статус 'Blocked')
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';  // Замените на реальную проверку в БД

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
            logger.error(`Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        await Log.create({ action: 'StopTransaction', chargePointId, payload: req });

        // Обновляем состояние коннектора: извлекаем connectorId из найденной транзакции
        const connectorId = tx.connectorId;  // Из модели Transaction (сохранено в StartTransaction)
        if (!connectorId) {
            logger.error(`No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }

        connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');

        logger.info(`Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);
        
        // Планируем сброс всех коннекторов в 'Available' через таймаут (стандарт OCPP)
        setTimeout(() => {
            connectionManager.resetAllConnectorsToAvailable(chargePointId);
        }, 2000);  // 2 секунды на Finishing

        return { idTagInfo: { status: idTagStatus } };
    } catch (err) {
        logger.error(`Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}