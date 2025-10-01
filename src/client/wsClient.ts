import WebSocket from 'ws';
import { logger } from '../logger';
import { handleResponse } from './responseHandler';
import { sendBootNotification } from './messageSender';
import { ClientManager } from './connectionManager';

const manager = new ClientManager(); // Создаем с дефолтным ID

export async function connectClient(chargePointId?: string) {
    const cpId = chargePointId || process.argv[2] || 'CP_001';

    // Обновляем manager с правильным ID
    (manager as any).chargePointManager = new (require('./stateManager').ChargePointManager)(cpId);

    return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:8000/ocpp?chargeBoxIdentity=${cpId}`);

        ws.on("open", () => {
            logger.info(`Charge point ${cpId} connected`);
            sendBootNotification(ws, {
                chargePointVendor: 'VendorTest',
                chargePointModel: 'ModelTest',
                chargeBoxSerialNumber: cpId,
                firmwareVersion: '1.0'
            }, manager);
            resolve(ws);
        });

        ws.on("message", (data: Buffer, isBinary: boolean) => {
            handleResponse(data, isBinary, ws);
        });

        ws.on("close", () => {
            logger.info(`Charge point ${cpId} disconnected`);
        });

        ws.on("error", (err: Error) => {
            logger.error(`Charge point ${cpId} error: ${err.message}`);
            reject(err);
        });
    });
}

export { manager };