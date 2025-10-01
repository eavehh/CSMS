"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsServer = void 0;
const ws_1 = require("ws");
const messageRouter_1 = require("./messageRouter");
const logger_1 = require("../logger");
const bootNotification_1 = require("./handlers/bootNotification");
class WsServer {
    constructor(httpServer, connectionManager) {
        this.wss = new ws_1.Server({
            server: httpServer,
            path: '/ocpp', // Клиент подключается к ws://localhost:8000/ocpp?chargeBoxIdentity=CP_001
        });
        this.wss.on('connection', (ws, req) => {
            // Извлекаем ID из URL (OCPP стандарт)
            const url = req.url || '';
            const params = new URLSearchParams(url.split('?')[1]);
            const chargePointId = params.get('chargeBoxIdentity') || 'unknown';
            logger_1.logger?.info(`Connected: ${chargePointId}`);
            connectionManager.add(ws, chargePointId); // Добавляем в менеджер
            ws.on('message', (data, isBinary) => {
                (0, messageRouter_1.handleMessage)(data, isBinary, ws, chargePointId); // Роутим сообщение
            });
            if (!connectionManager.isActive(chargePointId)) {
                logger_1.logger.info(`terminate connection with ${chargePointId}, there is not isAlive`);
                ws.terminate();
            }
            ws.on('close', () => {
                logger_1.logger?.info(`Disconnected: ${chargePointId}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                connectionManager.remove(chargePointId);
            });
            ws.on('error', (err) => {
                logger_1.logger?.error(`WS error: ${err.message}`);
            });
            setInterval(() => {
                this.wss.clients.forEach((ws) => {
                    const chargePointId = connectionManager.getByWs(ws); // Добавь метод в connectionManager
                    if (connectionManager.lastActivity) {
                        if (chargePointId && !connectionManager.isActive(chargePointId)) {
                            logger_1.logger.info(`Terminate a not active connection ${chargePointId}`);
                            ws.terminate();
                        }
                    }
                });
            }, bootNotification_1.INTERVAL); // 60s timeout default
        });
    }
    close() {
        this.wss.close();
    }
}
exports.WsServer = WsServer;
