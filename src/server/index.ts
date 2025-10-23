import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from '../logger';
// import { AppDataSource } from '../db/postgres';  // DISABLED for experiment/no-postgres
import { connectDB } from '../db/mongoose';
import { handleHttpRequest } from '../api/httpHandlers'



const PORT = 8081;

// Создаём HTTP-сервер
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    logger.info(`[index API] httpServer is created`)
    try {
        handleHttpRequest(req, res, connectionManager)
    } catch (err) {
        logger.info(`[index API] httpServer Faild: ${err}`)
    }
});

export let connectionManager = new ConnectionManager();

// Создаём WS-сервер
const wsServer = new WsServer(httpServer, connectionManager);

// Graceful shutdown
export let shutdownTimeout: NodeJS.Timeout | null = null;
const SHUTDOWN_TIMEOUT = 30000;  // 30 секунд на завершение соединений

function initiateShutdown(signal: string) {
    logger.info(`[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

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
        const remaining = connectionManager.getAllConnections()?.size || 0;
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
    try {
        // Инициализируем MongoDB
        await connectDB();
        logger.info('[MONGO] MongoDB connected');

        // 🔥 ЭКСПЕРИМЕНТ: PostgreSQL отключен, используем только in-memory хранилище
        // await AppDataSource.initialize();
        // logger.info('[POSTGRES] PostgreSQL connected');
        logger.info('[EXPERIMENT] PostgreSQL DISABLED - using in-memory storage only');

        // Запускаем HTTP сервер только после инициализации всех БД
        logger.info('[HTTP_SERVER] Starting HTTP server...');
        httpServer.listen(PORT, '0.0.0.0', () => {
            logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT} and listening on all interfaces (0.0.0.0)`);
            logger.info(`[MAIN] External IP: 193.29.139.202`);
            logger.info(`[MAIN] Local IP: 192.168.88.54`);
            logger.info(`[MAIN] Ready for charge point connections`);
        });
    } catch (error) {
        logger.error(`[MAIN] Failed to initialize server: ${error}`);
        process.exit(1);
    }
})();