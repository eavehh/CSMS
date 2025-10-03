import WebSocket, { Server as WSServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ConnectionManager } from './connectionManager';
import { handleMessage } from './messageRouter';
import { logger } from '../logger';
import { INTERVAL } from './handlers/bootNotification'
export class WsServer {
    private wss: WSServer;
    private cleanupInterval: NodeJS.Timeout;

    constructor(httpServer: HttpServer, connectionManager: ConnectionManager) {
        this.wss = new WSServer({
            server: httpServer,
            path: '/ocpp',
        });
        let chargePointId : string
        this.wss.on('connection', (ws: WebSocket, req: any) => {
            this.wss.on('connection', (ws: WebSocket, req: any) => {
                const url = req.url || '';
                logger.info(`[CONNECTION] New connection: ${url}`);

                // Универсальный парсинг - ищем chargeBoxIdentity в любом месте URL
                const urlParts = url.split('?');
                const params = new URLSearchParams(urlParts[1] || '');

                chargePointId = params.get('chargeBoxIdentity') || 'unknown';

                // Если не нашли в параметрах, пробуем извлечь из пути
                if (chargePointId === 'unknown') {
                    const pathParts = urlParts[0].split('/');
                    // Ищем последнюю непустую часть пути как chargePointId
                    chargePointId = pathParts.filter((part :any) => part.length > 0).pop() || 'unknown';
                }

                logger.info(`[CONNECTION] Extracted chargeBoxIdentity: ${chargePointId}`);

                // Добавляем соединение
                connectionManager.add(ws, chargePointId);
                // ... остальной код
            });
            // ЗАТЕМ обновляем активность
            connectionManager.updateLastActivity(chargePointId);

            ws.on('message', (data: Buffer, isBinary: boolean) => {
                handleMessage(data, isBinary, ws, chargePointId);
            });

            ws.on('close', () => {
                logger?.info(`Disconnected: ${chargePointId}`);
                connectionManager.setLastOffline(chargePointId, new Date());
                connectionManager.remove(chargePointId);
            });

            ws.on('error', (err) => {
                logger?.error(`WS error for ${chargePointId}: ${err.message}`);
            });
        });

        // Запускаем очистку неактивных соединений каждые 5 минут вместо 60 секунд
        this.cleanupInterval = setInterval(() => {
            this.wss.clients.forEach((ws: WebSocket) => {
                const chargePointId = connectionManager.getByWs(ws);
                if (chargePointId && !connectionManager.isActive(chargePointId, 60 * 1000)) { // 5 минут таймаут
                    logger.info(`Terminate inactive connection: ${chargePointId}`);
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