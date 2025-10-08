"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTimeout = exports.connectionManager = void 0;
const http_1 = require("http");
const wsServer_1 = require("./wsServer");
const connectionManager_1 = require("./connectionManager");
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
const PORT = 8081;
// Создаём HTTP-сервер
const httpServer = (0, http_1.createServer)((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}\n`);
});
exports.connectionManager = new connectionManager_1.ConnectionManager();
// Создаём WS-сервер
const wsServer = new wsServer_1.WsServer(httpServer, exports.connectionManager);
// Graceful shutdown
exports.shutdownTimeout = null;
const SHUTDOWN_TIMEOUT = 30000; // 30 секунд на завершение соединений
function initiateShutdown(signal) {
    logger_1.logger.info(`[SHUTDOWN] Received ${signal}. Initiating closing connection`);
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
        const remaining = exports.connectionManager.getAllConnections()?.size;
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
    await (0, mongoose_1.connectDB)();
    logger_1.logger.info('[HTTP_SERVER] Starting HTTP server...');
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT}`);
    });
})();
