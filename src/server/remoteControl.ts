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