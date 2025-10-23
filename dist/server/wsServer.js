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
        this.WATCHDOG_CHECK_MS = Number(process.env.WATCHDOG_CHECK_MS || 15000);
        this.IDLE_MS = Number(process.env.IDLE_MS || 60000);
        this.RECONNECT_HINT_MS = Number(process.env.RECONNECT_HINT_MS || 60000);
        logger_1.logger.info('[wsServer] Creating WebSocket server...');
        this.wss = new ws_1.Server({
            server: httpServer,
            path: '' // Или уберите для универсальности
        });
        logger_1.logger.info('[wsServer] WebSocket server instance created');
        this.wss.on('error', (error) => {
            logger_1.logger.error(`[wsServer] Error: ${error.message}`);
        });
        this.wss.on('connection', (ws, req) => {
            // Origin enforcement (basic)
            const allowedOrigin = process.env.ALLOWED_ORIGIN;
            if (allowedOrigin) {
                const origin = req.headers['origin'];
                if (origin && origin !== allowedOrigin) {
                    logger_1.logger.warn(`[CONNECTION] Rejecting origin ${origin} (allowed: ${allowedOrigin})`);
                    try {
                        ws.terminate();
                    }
                    catch { }
                    return;
                }
            }
            // Блокировка новых подключений во время shutdown
            if (this.isShuttingDown()) {
                logger_1.logger.info('[wsServer] CS try to connect to the server; Rejecting new connection during shutdown');
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
            logger_1.logger.info(`[wsServer] CS added to the connection manager - ${chargePointId}`);
            connectionManager.updateLastActivity(chargePointId);
            // --- Activity watchdog (ping/pong + idle 60s) ---
            let lastMessageAt = Date.now();
            let isAlive = true;
            ws.isAlive = true;
            const heartbeat = () => {
                ws.isAlive = true;
                lastMessageAt = Date.now();
                connectionManager.updateLastActivity(chargePointId);
            };
            ws.on('pong', heartbeat);
            const watchdog = setInterval(() => {
                const idleMs = Date.now() - lastMessageAt;
                if (ws.isAlive === false) {
                    logger_1.logger.warn(`[WATCHDOG] Terminating unresponsive WS ${chargePointId}`);
                    clearInterval(watchdog);
                    try {
                        ws.terminate();
                    }
                    catch { }
                    return;
                }
                if (idleMs > this.IDLE_MS) {
                    logger_1.logger.warn(`[WATCHDOG] ${chargePointId} idle ${idleMs}ms (>${this.IDLE_MS}ms), sending ping`);
                }
                ws.isAlive = false;
                try {
                    ws.ping();
                }
                catch { }
            }, this.WATCHDOG_CHECK_MS);
            ws.on('message', (data, isBinary) => {
                // Enforce raw message size limit (binary or text before parsing)
                const maxBytes = Number(process.env.WS_MAX_MESSAGE_BYTES || 32768); // 32KB default
                if (data.length > maxBytes) {
                    logger_1.logger.warn(`[SIZE] Message ${data.length}B exceeds limit ${maxBytes}B from ${chargePointId}; terminating`);
                    try {
                        ws.send(JSON.stringify({ event: 'message.too.large', ts: Date.now(), size: data.length, max: maxBytes }));
                    }
                    catch { }
                    try {
                        ws.terminate();
                    }
                    catch { }
                    return;
                }
                if (isBinary) {
                    logger_1.logger.info(`[MESSAGE] binary received from ${chargePointId}`);
                }
                else {
                    logger_1.logger.info(`[MESSAGE] json received from ${chargePointId}`);
                }
                // Rate limiting
                const limitWindowMs = 10000; // 10s
                const maxMessages = Number(process.env.WS_RATE_MAX || 50);
                const now = Date.now();
                const state = ws.rate || { windowStart: now, count: 0 };
                if (now - state.windowStart > limitWindowMs) {
                    state.windowStart = now;
                    state.count = 0;
                }
                state.count++;
                ws.rate = state;
                if (state.count > maxMessages) {
                    logger_1.logger.warn(`[RATE] Exceeded limit ${state.count}/${maxMessages} for ${chargePointId}; terminating`);
                    try {
                        ws.send(JSON.stringify({ event: 'rate.limit', ts: Date.now(), max: maxMessages }));
                    }
                    catch { }
                    try {
                        ws.terminate();
                    }
                    catch { }
                    return;
                }
                heartbeat();
                (0, messageRouter_1.handleMessage)(data, isBinary, ws, chargePointId);
            });
            ws.on('close', (code, reason) => {
                logger_1.logger.info(`[CLOSE] Disconnected: ${chargePointId}, code: ${code}, reason: ${reason}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                // ВАЖНО: не удаляем состояния коннекторов, чтобы сессии не терялись
                connectionManager.detachSocketOnly(chargePointId);
                try {
                    clearInterval(watchdog);
                }
                catch { }
                this.notifyConnectionClosed(); // Уведомляем о закрытии
                if (connectionManager.reservationCleanupInterval) {
                    clearInterval(connectionManager.reservationCleanupInterval);
                    connectionManager.reservationCleanupInterval = null;
                }
                // Плановая попытка восстановления через 60с (логируем хук)
                setTimeout(() => {
                    logger_1.logger.warn(`[RECONNECT] ${this.RECONNECT_HINT_MS}ms passed since disconnect of ${chargePointId}. If the station supports outbound, attempt reconnect from station. Server will accept.`);
                }, this.RECONNECT_HINT_MS);
            });
            ws.on('error', (err) => {
                logger_1.logger.error(`[WS_error] for ${chargePointId}: ${err.message}`);
            });
            logger_1.logger.info(`[CONNECTION] Successfully setup connection for ${chargePointId}`);
        });
        // Интервал очистки неактивных (как ранее)
        this.cleanupInterval = setInterval(() => {
            const clientCount = this.wss.clients.size;
            logger_1.logger.info(`[WsServer] [CLEANUP] Checking ${clientCount} clients for activity`);
            this.wss.clients.forEach((ws) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId)) { // в течении 24 часов
                    logger_1.logger.info(`[WsServer] [CLEANUP] Terminate inactive connection: ${chargePointId}`);
                    ws.terminate();
                }
            });
        }, 1000 * 60 * 60 * 24);
        connectionManager.reservationCleanupInterval = setInterval(() => {
            logger_1.logger.debug('[WsServer] Reservation Cleanup: Starting expired reservation check');
            connectionManager.cleanupExpiredReservations(); // Вызов функции
            logger_1.logger.debug('[WsServer] Reservation Cleanup: Check completed');
        }, 60000 * 10); // Каждые 10 минут
        logger_1.logger.info('[wsServer] WebSocket server setup complete');
    }
    // Новый метод: Блокировать новые подключения во время shutdown
    closeNewConnections() {
        logger_1.logger.info('[wsServer] Closing new connections');
        this.wss.options = { ...this.wss.options, noServer: true }; // Блокируем
        this.wss.clients.forEach(ws => ws.terminate());
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
        logger_1.logger.info('[wsServer] Closing WebSocket server');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (index_1.connectionManager.reservationCleanupInterval) {
            clearInterval(index_1.connectionManager.reservationCleanupInterval);
            index_1.connectionManager.reservationCleanupInterval = null;
        }
        this.wss.close((error) => {
            if (error) {
                logger_1.logger.error(`[wsServer] Close error: ${error.message}`);
            }
            else {
                logger_1.logger.info('[wsServer] WebSocket server closed');
            }
        });
    }
}
exports.WsServer = WsServer;
