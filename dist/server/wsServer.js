"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsServer = void 0;
const ws_1 = require("ws");
const messageRouter_1 = require("./messageRouter");
const logger_1 = require("../logger");
const index_1 = require("./index");
class WsServer {
    constructor(httpServer, connectionManager) {
        this.cleanupInterval = null;
        this.connectionCloseListeners = []; // Для уведомлений о закрытии
        logger_1.logger.info('[WS_SERVER] Creating WebSocket server...');
        this.wss = new ws_1.Server({
            server: httpServer,
            path: '/ocpp' // Или уберите для универсальности
        });
        logger_1.logger.info('[WS_SERVER] WebSocket server instance created');
        this.wss.on('error', (error) => {
            logger_1.logger.error(`[WS_SERVER] Error: ${error.message}`);
        });
        this.wss.on('connection', (ws, req) => {
            // Блокировка новых подключений во время shutdown
            if (this.isShuttingDown()) {
                logger_1.logger.info('[WS_SERVER] Rejecting new connection during shutdown');
                ws.terminate();
                return;
            }
            const url = req.url || '';
            logger_1.logger.info(`[CONNECTION] New connection: ${url}`);
            logger_1.logger.info(`[CONNECTION] Headers: ${JSON.stringify(req.headers)}`);
            let chargePointId = 'unknown';
            // Парсинг chargeBoxIdentity (как ранее)
            const urlParams = new URLSearchParams(url.split('?')[1] || '');
            chargePointId = urlParams.get('chargeBoxIdentity') || urlParams.get('chargePointId') || 'unknown';
            if (chargePointId === 'unknown') {
                const path = url.split('?')[0];
                const pathParts = path.split('/').filter((p) => p.length > 0);
                if (pathParts.length > 0) {
                    chargePointId = pathParts[pathParts.length - 1];
                }
            }
            logger_1.logger.info(`[CONNECTION] ChargePoint ID: ${chargePointId}`);
            connectionManager.add(ws, chargePointId);
            connectionManager.updateLastActivity(chargePointId);
            ws.on('message', (data, isBinary) => {
                logger_1.logger.info(`[MESSAGE] Received from ${chargePointId}, binary: ${isBinary}`);
                (0, messageRouter_1.handleMessage)(data, isBinary, ws, chargePointId);
            });
            ws.on('close', (code, reason) => {
                logger_1.logger.info(`[CLOSE] Disconnected: ${chargePointId}, code: ${code}, reason: ${reason}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                connectionManager.remove(chargePointId);
                this.notifyConnectionClosed(); // Уведомляем о закрытии
            });
            ws.on('error', (err) => {
                logger_1.logger.error(`[ERROR] WS error for ${chargePointId}: ${err.message}`);
            });
            logger_1.logger.info(`[CONNECTION] Successfully setup connection for ${chargePointId}`);
        });
        // Интервал очистки неактивных (как ранее)
        this.cleanupInterval = setInterval(() => {
            const clientCount = this.wss.clients.size;
            logger_1.logger.info(`[CLEANUP] Checking ${clientCount} clients for activity`);
            this.wss.clients.forEach((ws) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId, 5 * 60 * 1000)) {
                    logger_1.logger.info(`[CLEANUP] Terminate inactive connection: ${chargePointId}`);
                    ws.terminate();
                }
            });
        }, 300000); // 5 минут
        logger_1.logger.info('[WS_SERVER] WebSocket server setup complete');
    }
    // Новый метод: Блокировать новые подключения во время shutdown
    closeNewConnections() {
        logger_1.logger.info('[WS_SERVER] Closing new connections');
        this.wss.options = { ...this.wss.options, noServer: true }; // Блокируем
        // Принудительно закрываем все активные (опционально, если нужно)
        // this.wss.clients.forEach(ws => ws.terminate());
    }
    // Новый метод: Регистрация слушателя для уведомлений о закрытии соединений
    onConnectionClosed(listener) {
        this.connectionCloseListeners.push(listener);
    }
    notifyConnectionClosed() {
        this.connectionCloseListeners.forEach(listener => listener());
    }
    isShuttingDown() {
        return index_1.shutdownTimeout !== null; // Глобальная переменная из index.ts (или используйте флаг)
    }
    close() {
        logger_1.logger.info('[WS_SERVER] Closing WebSocket server');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.wss.close((error) => {
            if (error) {
                logger_1.logger.error(`[WS_SERVER] Close error: ${error.message}`);
            }
            else {
                logger_1.logger.info('[WS_SERVER] WebSocket server closed');
            }
        });
    }
}
exports.WsServer = WsServer;
