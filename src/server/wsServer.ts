import WebSocket, { Server as WSServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ConnectionManager } from './connectionManager';
import { handleMessage } from './messageRouter';
import { logger } from '../logger';
import { connectionManager, shutdownTimeout } from './index'

export class WsServer {
    private wss: WSServer;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private connectionCloseListeners: Array<() => void> = [];  // Для уведомлений о закрытии
    private readonly WATCHDOG_CHECK_MS = Number(process.env.WATCHDOG_CHECK_MS || 15000);
    private readonly IDLE_MS = Number(process.env.IDLE_MS || 60000);
    private readonly RECONNECT_HINT_MS = Number(process.env.RECONNECT_HINT_MS || 60000);

    constructor(httpServer: HttpServer, connectionManager: ConnectionManager) {
        logger.info('[wsServer] Creating WebSocket server...');

        this.wss = new WSServer({
            server: httpServer,
            path: ''  // Или уберите для универсальности
        });

        logger.info('[wsServer] WebSocket server instance created');

        this.wss.on('error', (error) => {
            logger.error(`[wsServer] Error: ${error.message}`);
        });

        this.wss.on('connection', (ws: WebSocket, req: any) => {
            // Блокировка новых подключений во время shutdown
            if (this.isShuttingDown()) {
                logger.info('[wsServer] CS try to connect to the server; Rejecting new connection during shutdown');
                ws.terminate();
                return;
            }

            const url = req.url || '';
            logger.info(`[CONNECTION] New connection: ${url}`);
            logger.info(`[CONNECTION] Headers: ${JSON.stringify(req.headers)}`);

            let chargePointId = 'unknown';

            // Парсинг chargeBoxIdentity (как ранее)
            const urlParams = new URLSearchParams(url.split('?')[1] || '');
            chargePointId = urlParams.get('chargeBoxIdentity') || urlParams.get('chargePointId') || 'unknown';

            if (chargePointId === 'unknown') {
                const path = url.split('?')[0];
                const pathParts = path.split('/').filter((p: any) => p.length > 0);
                if (pathParts.length > 0) {
                    chargePointId = pathParts[pathParts.length - 1];
                }
            }

            logger.info(`[CONNECTION] ChargePoint ID: ${chargePointId}`);

            connectionManager.add(ws, chargePointId);
            logger.info(`[wsServer] CS added to the connection manager - ${chargePointId}`);
            connectionManager.updateLastActivity(chargePointId);

            // --- Activity watchdog (ping/pong + idle 60s) ---
            let lastMessageAt = Date.now();
            let isAlive = true;
            (ws as any).isAlive = true;

            const heartbeat = () => {
                (ws as any).isAlive = true;
                lastMessageAt = Date.now();
                connectionManager.updateLastActivity(chargePointId);
            };

            ws.on('pong', heartbeat);

            const watchdog = setInterval(() => {
                const idleMs = Date.now() - lastMessageAt;
                if ((ws as any).isAlive === false) {
                    logger.warn(`[WATCHDOG] Terminating unresponsive WS ${chargePointId}`);
                    clearInterval(watchdog);
                    try { ws.terminate(); } catch {}
                    return;
                }
                if (idleMs > this.IDLE_MS) {
                    logger.warn(`[WATCHDOG] ${chargePointId} idle ${idleMs}ms (>${this.IDLE_MS}ms), sending ping`);
                }
                (ws as any).isAlive = false;
                try { ws.ping(); } catch {}
            }, this.WATCHDOG_CHECK_MS);

            ws.on('message', (data: Buffer, isBinary: boolean) => {
                if (isBinary) {
                    logger.info(`[MESSAGE] binary received from ${chargePointId}`);
                } else {
                    logger.info(`[MESSAGE] json received from ${chargePointId}`);
                }
                heartbeat();
                handleMessage(data, isBinary, ws, chargePointId);
            });

            ws.on('close', (code, reason) => {
                logger.info(`[CLOSE] Disconnected: ${chargePointId}, code: ${code}, reason: ${reason}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                // ВАЖНО: не удаляем состояния коннекторов, чтобы сессии не терялись
                connectionManager.detachSocketOnly(chargePointId);
                try { clearInterval(watchdog); } catch {}
                this.notifyConnectionClosed();  // Уведомляем о закрытии
                if (connectionManager.reservationCleanupInterval) {
                    clearInterval(connectionManager.reservationCleanupInterval);
                    connectionManager.reservationCleanupInterval = null;
                }

                // Плановая попытка восстановления через 60с (логируем хук)
                setTimeout(() => {
                    logger.warn(`[RECONNECT] ${this.RECONNECT_HINT_MS}ms passed since disconnect of ${chargePointId}. If the station supports outbound, attempt reconnect from station. Server will accept.`);
                }, this.RECONNECT_HINT_MS);
            });

            ws.on('error', (err) => {
                logger.error(`[WS_error] for ${chargePointId}: ${err.message}`);
            });

            logger.info(`[CONNECTION] Successfully setup connection for ${chargePointId}`);
        });

        // Интервал очистки неактивных (как ранее)
        this.cleanupInterval = setInterval(() => {
            const clientCount = this.wss.clients.size;
            logger.info(`[WsServer] [CLEANUP] Checking ${clientCount} clients for activity`);

            this.wss.clients.forEach((ws: WebSocket) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId)) { // в течении 24 часов
                    logger.info(`[WsServer] [CLEANUP] Terminate inactive connection: ${chargePointId}`);
                    ws.terminate();
                }
            });
        }, 1000 * 60 * 60 * 24);

        connectionManager.reservationCleanupInterval = setInterval(() => {
            logger.debug('[WsServer] Reservation Cleanup: Starting expired reservation check');
            connectionManager.cleanupExpiredReservations();  // Вызов функции
            logger.debug('[WsServer] Reservation Cleanup: Check completed');
        }, 60000 * 10);  // Каждые 10 минут


        logger.info('[wsServer] WebSocket server setup complete');
    }

    // Новый метод: Блокировать новые подключения во время shutdown
    closeNewConnections() {
        logger.info('[wsServer] Closing new connections');
        this.wss.options = { ...this.wss.options, noServer: true };  // Блокируем
        this.wss.clients.forEach(ws => ws.terminate());
    }

    // Новый метод: Регистрация слушателя для уведомлений о закрытии соединений
    onConnectionClosed(listener: () => void) {
        this.connectionCloseListeners.push(listener);
    }

    private notifyConnectionClosed() {
        this.connectionCloseListeners.forEach(listener => listener());
    }

    private isShuttingDown(): boolean {
        return shutdownTimeout !== null;  // Глобальная переменная из index.ts (или используйте флаг)
    }


    close() {
        logger.info('[wsServer] Closing WebSocket server');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (connectionManager.reservationCleanupInterval) {
            clearInterval(connectionManager.reservationCleanupInterval);
            connectionManager.reservationCleanupInterval = null;
        }

        this.wss.close((error?: Error) => {
            if (error) {
                logger.error(`[wsServer] Close error: ${error.message}`);
            } else {
                logger.info('[wsServer] WebSocket server closed');
            }
        });
    }
}