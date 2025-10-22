"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTimeout = exports.connectionManager = void 0;
const http_1 = require("http");
const wsServer_1 = require("./wsServer");
const connectionManager_1 = require("./connectionManager");
const logger_1 = require("../logger");
const postgres_1 = require("../db/postgres");
const mongoose_1 = require("../db/mongoose");
const httpHandlers_1 = require("../api/httpHandlers");
const PORT = 8081;
// Создаём HTTP-сервер
const httpServer = (0, http_1.createServer)((req, res) => {
    logger_1.logger.info(`[index API] httpServer is created`);
    try {
        (0, httpHandlers_1.handleHttpRequest)(req, res);
    }
    catch (err) {
        logger_1.logger.info(`[index API] httpServer Faild: ${err}`);
    }
});
exports.connectionManager = new connectionManager_1.ConnectionManager();
// Создаём WS-сервер
const wsServer = new wsServer_1.WsServer(httpServer, exports.connectionManager);
// Graceful shutdown
exports.shutdownTimeout = null;
const SHUTDOWN_TIMEOUT = 30000; // 30 секунд на завершение соединений
function initiateShutdown(signal) {
    logger_1.logger.info(`[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);
    // Закрываем новые подключения в WS
    wsServer.closeNewConnections();
    // Устанавливаем таймаут для принудительного завершения
    exports.shutdownTimeout = setTimeout(() => {
        logger_1.logger.warn(`[SHUTDOWN] Force closing after ${SHUTDOWN_TIMEOUT}ms`);
        httpServer.close(() => {
            process.exit(1); // Принудительное завершение
        });
    }, SHUTDOWN_TIMEOUT);
    // Ждём закрытия всех соединений
    const checkConnections = () => {
        const remaining = exports.connectionManager.getAllConnections()?.size || 0;
        if (remaining === 0) {
            logger_1.logger.info('[SHUTDOWN] All connections closed. Shutting down.');
            clearTimeout(exports.shutdownTimeout);
            httpServer.close(() => process.exit(0));
        }
        else {
            logger_1.logger.info(`[SHUTDOWN] Waiting for ${remaining} connections to close...`);
            setTimeout(checkConnections, 1000); // Проверяем каждую секунду
        }
    };
    setImmediate(checkConnections);
}
// Обработка сигналов
process.on('SIGINT', () => initiateShutdown('SIGINT'));
process.on('SIGTERM', () => initiateShutdown('SIGTERM'));
httpServer.on('error', (error) => {
    logger_1.logger.error(`[HTTP_SERVER] Error: ${error.message}`);
});
(async () => {
    try {
        // Инициализируем MongoDB
        await (0, mongoose_1.connectDB)();
        logger_1.logger.info('[MONGO] MongoDB connected');
        await postgres_1.AppDataSource.initialize();
        logger_1.logger.info('[POSTGRES] PostgreSQL connected');
        // Запускаем HTTP сервер только после инициализации всех БД
        logger_1.logger.info('[HTTP_SERVER] Starting HTTP server...');
        httpServer.listen(PORT, '0.0.0.0', () => {
            logger_1.logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT} and listening on all interfaces (0.0.0.0)`);
            logger_1.logger.info(`[MAIN] External IP: 193.29.139.202`);
            logger_1.logger.info(`[MAIN] Local IP: 192.168.88.54`);
            logger_1.logger.info(`[MAIN] Ready for charge point connections`);
        });
    }
    catch (error) {
        logger_1.logger.error(`[MAIN] Failed to initialize server: ${error}`);
        process.exit(1);
    }
})();
