import { StartTransactionRequest } from '../types/1.6/StartTransaction';
import { StartTransactionResponse } from '../types/1.6/StartTransactionResponse';
import { Transaction } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';
import { connectionManager } from '../../server/index';
import { resolve } from 'path';

export async function handleStartTransaction(req: StartTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StartTransactionResponse> {
    const transId = Date.now();  // Генерация числового ID (миллисекунды с эпохи — уникально в пределах сессии)

    try {
        // Проверка авторизации ID-тега (стандарт OCPP: если не авторизован, статус 'Blocked')
        // Здесь можно добавить запрос в БД авторизаций (предполагаем, что ID-тег авторизован)
        const idTagStatus = 'Accepted';  // Замените на реальную проверку

        const newTx = new Transaction({
            id: transId.toString(),  // Сохраняем как строку в БД, если модель ожидает string
            chargePointId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            connectorId: req.connectorId,
            meterStart: req.meterStart
        });
        await newTx.save();
        await Log.create({ action: 'StartTransaction', chargePointId, payload: req });

        // Формируем ответ (transactionId как number)
        const response: StartTransactionResponse = {
            transactionId: transId,  // Теперь соответствует типу number
            idTagInfo: {
                status: idTagStatus  // 'Accepted' или 'Blocked'
            }
        };

        logger.info(`Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);

        // Обновляем состояние коннектора (transId как number, но если ConnectorState.transactionId ожидает string, приведите: transId.toString())
        connectionManager.updateConnectorState(chargePointId, req.connectorId, 'Charging', transId.toString());

        return response;
    } catch (err) {
        logger.error(`Error in StartTransaction: ${err}`);
        const errorResponse: StartTransactionResponse = {
            idTagInfo: { status: 'Invalid' },
            transactionId: transId  // Числовой ID даже при ошибке
        };
        return errorResponse;
    }
}