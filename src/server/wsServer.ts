import WebSocket, { Server as WSServer } from 'ws';
import { Server as HttpServer } from 'http';
import { ConnectionManager } from './connectionManager';
import { handleMessage } from './messageRouter';
import { logger } from './logger';

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
            
            (ws as any).isAlive = true; 
            ws.on("pong", () => { (ws as any).isAlive = true });

            ws.on('message', (data: Buffer, isBinary: boolean) => {
                handleMessage(data, isBinary, ws, chargePointId);  // Роутим сообщение
            });

            ws.on('close', () => {
                logger?.info(`Disconnected: ${chargePointId}`);
                connectionManager.remove(chargePointId);
            });

            ws.on('error', (err) => {
                logger?.error(`WS error: ${err.message}`);
            });

            //ping interval
            setInterval(() => {
                this.wss.clients.forEach((ws: WebSocket) => {
                    if (!(ws as any).isAlive) {
                        logger.error(`Terminating dead connection`)
                        ws.terminate()
                        return
                    }
                    (ws as any).isAlive = false;
                    ws.ping(() => { });  // Node.js callback для ping
                })
            }, 30000) // ping каждые 30 sec
        });
    }

    close() {
        this.wss.close();
    }
}