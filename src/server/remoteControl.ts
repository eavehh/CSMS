import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { logger } from '../logger';
import { ConnectionManager } from './connectionManager';
import * as msgpack from '@msgpack/msgpack'

export function sendRemoteMessage(
    connectionManager: ConnectionManager,
    chargePointId: string,
    action: string,
    payload: any
): void {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger.error(`[RemoteControl] No WebSocket for ${chargePointId} — cannot send ${action}`);
        return;
    }

    const uniqueId = uuidv4();
    const message = [2, uniqueId, action, payload];

    if (connectionManager.getFormat(chargePointId) === 'binary') {
        try {
            ws.send(msgpack.encode(message));
        } catch (err) {
            logger.error(`[RemoteControl] sending binary message Error: ${err}`)
        }
    } else {
        try {
            ws.send(JSON.stringify(message));
        } catch (err) {
            logger.error(`[RemoteControl] sending JSON message Error: ${err}`)
        }
    }
    logger.info(`[RemoteControl] Sent ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
}

// Специфическая функция для Reservation Profile
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

export function sendCancelReservation(
    connectionManager: ConnectionManager,
    chargePointId: string,
    reservationId: number
): void {
    const payload = { reservationId };
    sendRemoteMessage(connectionManager, chargePointId, 'CancelReservation', payload);
}


// Тип для payload (из types/1.6/RemoteStartTransaction)
export interface RemoteStartTransactionPayload {
    idTag: string;  // ID-тег для авторизации
    connectorId?: number;  // Конкретный коннектор (опционально; дефолт 1)
    startValue?: number;  // meterStart (опционально; дефолт 0)
}

export function sendRemoteStartTransaction(
    connectionManager: ConnectionManager,
    chargePointId: string,
    payload: RemoteStartTransactionPayload
): void {
    const fullPayload = {
        idTag: payload.idTag,
        connectorId: payload.connectorId || 1,  // Дефолт на первый коннектор
        startValue: payload.startValue || 0  // meterStart
    };

    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStartTransaction', fullPayload);
    logger.info(`[RemoteStartTransaction] Sent to ${chargePointId}: idTag=${fullPayload.idTag}, connectorId=${fullPayload.connectorId}, startValue=${fullPayload.startValue}`);
}
export interface RemoteStopTransactionPayload {
    transactionId: number | string;
    connectorId?: number;
    reason?: string;
}

export function sendRemoteStopTransaction(
    connectionManager: ConnectionManager,
    chargePointId: string,
    payload: RemoteStopTransactionPayload
): void {
    const fullPayload = {
        transactionId: typeof payload.transactionId === 'string' ? parseInt(payload.transactionId, 10) : payload.transactionId,
        connectorId: payload.connectorId || 1, // default to connector 1 if not provided
        reason: payload.reason || 'Remote'
    };

    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStopTransaction', fullPayload);
    logger.info(`[RemoteStopTransaction] Sent to ${chargePointId}: transactionId=${fullPayload.transactionId}, connectorId=${fullPayload.connectorId}, reason=${fullPayload.reason}`);
}