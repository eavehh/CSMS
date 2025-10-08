import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { logger } from '../logger';
import { ConnectionManager } from '../server/connectionManager'
import * as msgpack from '@msgpack/msgpack'

export function sendRemoteMessage(
    connectionManager: ConnectionManager,
    chargePointId: string,
    action: string,
    payload: any
): void {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger.error(`No active WebSocket for ${chargePointId} — cannot send ${action}`);
        return;
    }

    const uniqueId = uuidv4();

    // Ключевой вызов: Сохраняем pending перед отправкой
    connectionManager.setPendingRequest(uniqueId, action);

    const message = [2, uniqueId, action, payload];

    const format = connectionManager.getFormat(chargePointId);
    if (format === 'binary') {
        try{
        ws.send(msgpack.encode(message));  
        logger.info(`[RemoteControl] binary message sent: ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
        }catch(err){
            logger.error(`[RemoteControl] Faild to send a binary message: ${err}`)
            return
        }
    } else {
        try{
        ws.send(JSON.stringify(message));
        logger.info(`[RemoteControl] JSON message sent: ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
        }catch(err){
            logger.error(`[RemoteControl] Faild to send a JSON message: ${err}`)
        }
    }
}

// Пример для ReserveNow
export function sendReserveNow(
    connectionManager: ConnectionManager,
    chargePointId: string,
    connectorId: number,
    idTag: string,
    expiryDate: Date
): void {
    const payload = {
        connectorId,
        expiryDate: expiryDate.toISOString(),
        idTag
    };
    sendRemoteMessage(connectionManager, chargePointId, 'ReserveNow', payload);
}