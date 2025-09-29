import WebSocket from 'ws';
import { logger } from '../logger';
import { handleResponse } from './responseHandler';
import { sendBootNotification } from './messageSender';
import { ClientManager } from './connectionManager';  // Импорт класса

const manager = new ClientManager();  // Создай здесь

export async function connectClient() {
    return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8000/ocpp?chargeBoxIdentity=CP_001');
        ws.on("open", () => {
            logger.info("Charge point connected");
            sendBootNotification(ws, { chargePointVendor: 'VendorTest', chargePointModel: 'ModelTest', chargeBoxSerialNumber: 'SN123', firmwareVersion: '1.0' }, manager);  // Добавь manager
            resolve(ws);
        });
        ws.on("message", (data: Buffer, isBinary: boolean) => {
            handleResponse(data, isBinary, ws);
        });
        ws.on("close", () => {
            logger.info("Charge point disconnected");
        });
        ws.on("error", (err: Error) => {
            logger.error(`Charge point error: ${err.message}`);
            reject(err);
        });
    });
}