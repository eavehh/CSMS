import WebSocket, { Server as WSServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ConnectionManager } from './connectionManager';
import { handleMessage } from './messageRouter';
import { logger } from '../logger';
import { INTERVAL } from '../handlers/bootNotification'

export class WsServer {
    private wss: WSServer;

    constructor(httpServer: HttpServer, connectionManager: ConnectionManager) {
        this.wss = new WSServer({
            server: httpServer,
            path: '/ocpp',  // Клиент подключается к ws://localhost:8000/ocpp?chargeBoxIdentity=CP_001
        });

        this.wss.on('connection', (ws: WebSocket, req: any) => {
            // Извлекаем ID из URL (OCPP стандарт)
            const url = req.url || '';
            const params = new URLSearchParams(url.split('?')[1]);
            const chargePointId = params.get('chargeBoxIdentity') || 'unknown';

            logger?.info(`Connected: ${chargePointId}`);
            connectionManager.add(ws, chargePointId);  // Добавляем в менеджер

            ws.on('message', (data: Buffer, isBinary: boolean) => {
                handleMessage(data, isBinary, ws, chargePointId);  // Роутим сообщение
            });

            if (!connectionManager.isActive(chargePointId)) {
                logger.info(`terminate connection with ${chargePointId}, there is not isAlive`)
                ws.terminate()
            }

            ws.on('close', () => {
                logger?.info(`Disconnected: ${chargePointId}`);
                connectionManager.setLastOffline(chargePointId, new Date())
                connectionManager.remove(chargePointId);
            });

            ws.on('error', (err) => {
                logger?.error(`WS error: ${err.message}`);
            });

            setInterval(() => {
                this.wss.clients.forEach((ws: WebSocket) => {
                    const chargePointId = connectionManager.getByWs(ws);  // Добавь метод в connectionManager

                    if (connectionManager.lastActivity) {
                        if (chargePointId && !connectionManager.isActive(chargePointId)) {
                            logger.info(`Terminate a not active connection ${chargePointId}`);
                            ws.terminate();
                        }
                    }
                });
            }, INTERVAL);  // 60s timeout default

        });
    }

    close() {
        this.wss.close();
    }
}