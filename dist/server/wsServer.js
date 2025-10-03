"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsServer = void 0;
const ws_1 = require("ws");
const messageRouter_1 = require("./messageRouter");
const logger_1 = require("../logger");
class WsServer {
    constructor(httpServer, connectionManager) {
        this.wss = new ws_1.Server({
            server: httpServer,
            path: '/ocpp',
        });
        let chargePointId;
        this.wss.on('connection', (ws, req) => {
            this.wss.on('connection', (ws, req) => {
                const url = req.url || '';
                logger_1.logger.info(`[CONNECTION] New connection: ${url}`);
                // Универсальный парсинг - ищем chargeBoxIdentity в любом месте URL
                const urlParts = url.split('?');
                const params = new URLSearchParams(urlParts[1] || '');
                chargePointId = params.get('chargeBoxIdentity') || 'unknown';
                // Если не нашли в параметрах, пробуем извлечь из пути
                if (chargePointId === 'unknown') {
                    const pathParts = urlParts[0].split('/');
                    // Ищем последнюю непустую часть пути как chargePointId
                    chargePointId = pathParts.filter((part) => part.length > 0).pop() || 'unknown';
                }
                logger_1.logger.info(`[CONNECTION] Extracted chargeBoxIdentity: ${chargePointId}`);
                // Добавляем соединение
                connectionManager.add(ws, chargePointId);
                // ... остальной код
            });
            // ЗАТЕМ обновляем активность
            connectionManager.updateLastActivity(chargePointId);
            ws.on('message', (data, isBinary) => {
                (0, messageRouter_1.handleMessage)(data, isBinary, ws, chargePointId);
            });
            ws.on('close', () => {
                logger_1.logger?.info(`Disconnected: ${chargePointId}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                connectionManager.remove(chargePointId);
            });
            ws.on('error', (err) => {
                logger_1.logger?.error(`WS error for ${chargePointId}: ${err.message}`);
            });
        });
        // Запускаем очистку неактивных соединений каждые 5 минут вместо 60 секунд
        this.cleanupInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId, 60 * 1000)) { // 5 минут таймаут
                    logger_1.logger.info(`Terminate inactive connection: ${chargePointId}`);
                    ws.terminate();
                }
            });
        }, 300000); // 5 минут
    }
    close() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.wss.close();
    }
}
exports.WsServer = WsServer;
