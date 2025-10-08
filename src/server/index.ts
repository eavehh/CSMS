import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from '../logger';
import { connectDB } from '../db/mongoose';

const PORT = 8081;


// Создаём HTTP-сервер
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}\n`);
});

export let connectionManager = new ConnectionManager();

// Создаём WS-сервер
const wsServer = new WsServer(httpServer, connectionManager);

// Graceful shutdown
export let shutdownTimeout: NodeJS.Timeout | null = null;
const SHUTDOWN_TIMEOUT = 30000;  // 30 секунд на завершение соединений

function initiateShutdown(signal: string) {
    logger.info(`[SHUTDOWN] Received ${signal}. Initiating closing connection`);
    // Закрываем новые подключения в WS
    wsServer.closeNewConnections();

    // Устанавливаем таймаут для принудительного завершения
    shutdownTimeout = setTimeout(() => {
        logger.warn(`[SHUTDOWN] Force closing after ${SHUTDOWN_TIMEOUT}ms`);
        httpServer.close(() => {
            process.exit(1);  // Принудительное завершение
        });
    }, SHUTDOWN_TIMEOUT);

    // Ждём закрытия всех соединений
    const checkConnections = () => {
        const remaining = connectionManager.getAllConnections()?.size;
        if (remaining === 0) {
            logger.info('[SHUTDOWN] All connections closed. Shutting down.');
            clearTimeout(shutdownTimeout!);
            httpServer.close(() => process.exit(0));
        } else {
            logger.info(`[SHUTDOWN] Waiting for ${remaining} connections to close...`);
            setTimeout(checkConnections, 1000);  // Проверяем каждую секунду
        }
    };

    setImmediate(checkConnections);
}

// Обработка сигналов
process.on('SIGINT', () => initiateShutdown('SIGINT'));
process.on('SIGTERM', () => initiateShutdown('SIGTERM'));

httpServer.on('error', (error) => {
    logger.error(`[HTTP_SERVER] Error: ${error.message}`);
});

(async () => {
    await connectDB();
    logger.info('[HTTP_SERVER] Starting HTTP server...');
    httpServer.listen(PORT, () => {
        logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT}`);
    });
})();