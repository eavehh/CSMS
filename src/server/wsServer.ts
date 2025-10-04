import WebSocket, { Server as WSServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ConnectionManager } from './connectionManager';
import { handleMessage } from './messageRouter';
import { logger } from '../logger';
import {shutdownTimeout} from './index'
import { INTERVAL } from './handlers/bootNotification';

export class WsServer {
    private wss: WSServer;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private connectionCloseListeners: Array<() => void> = [];  // Для уведомлений о закрытии

    constructor(httpServer: HttpServer, connectionManager: ConnectionManager) {
        logger.info('[WS_SERVER] Creating WebSocket server...');

        this.wss = new WSServer({
            server: httpServer,
            path: '/ocpp'  // Или уберите для универсальности
        });

        logger.info('[WS_SERVER] WebSocket server instance created');

        this.wss.on('error', (error) => {
            logger.error(`[WS_SERVER] Error: ${error.message}`);
        });

        this.wss.on('connection', (ws: WebSocket, req: any) => {
            // Блокировка новых подключений во время shutdown
            if (this.isShuttingDown()) {
                logger.info('[WS_SERVER] Rejecting new connection during shutdown');
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
                const pathParts = path.split('/').filter((p :any) => p.length > 0);
                if (pathParts.length > 0) {
                    chargePointId = pathParts[pathParts.length - 1];
                }
            }

            logger.info(`[CONNECTION] ChargePoint ID: ${chargePointId}`);

            connectionManager.add(ws, chargePointId);
            connectionManager.updateLastActivity(chargePointId);

            ws.on('message', (data: Buffer, isBinary: boolean) => {
                logger.info(`[MESSAGE] Received from ${chargePointId}, binary: ${isBinary}`);
                handleMessage(data, isBinary, ws, chargePointId);
            });

            ws.on('close', (code, reason) => {
                logger.info(`[CLOSE] Disconnected: ${chargePointId}, code: ${code}, reason: ${reason}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                connectionManager.remove(chargePointId);
                this.notifyConnectionClosed();  // Уведомляем о закрытии
            });

            ws.on('error', (err) => {
                logger.error(`[ERROR] WS error for ${chargePointId}: ${err.message}`);
            });

            logger.info(`[CONNECTION] Successfully setup connection for ${chargePointId}`);
        });

        // Интервал очистки неактивных (как ранее)
        this.cleanupInterval = setInterval(() => {
            const clientCount = this.wss.clients.size;
            logger.info(`[CLEANUP] Checking ${clientCount} clients for activity`);

            this.wss.clients.forEach((ws: WebSocket) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId, 5 * 60 * 1000)) {
                    logger.info(`[CLEANUP] Terminate inactive connection: ${chargePointId}`);
                    ws.terminate();
                }
            });
        }, 300000);  // 5 минут

        logger.info('[WS_SERVER] WebSocket server setup complete');
    }

    // Новый метод: Блокировать новые подключения во время shutdown
    closeNewConnections() {
        logger.info('[WS_SERVER] Closing new connections');
        this.wss.options = { ...this.wss.options, noServer: true };  // Блокируем
        // Принудительно закрываем все активные (опционально, если нужно)
        // this.wss.clients.forEach(ws => ws.terminate());
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
        logger.info('[WS_SERVER] Closing WebSocket server');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.wss.close((error?: Error) => {
            if (error) {
                logger.error(`[WS_SERVER] Close error: ${error.message}`);
            } else {
                logger.info('[WS_SERVER] WebSocket server closed');
            }
        });
    }
}