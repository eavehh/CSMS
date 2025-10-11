"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownTimeout = exports.connectionManager = void 0;
const http_1 = require("http");
const url_1 = require("url"); // Встроенный модуль для парсинга URL
const wsServer_1 = require("./wsServer");
const connectionManager_1 = require("./connectionManager");
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
const PORT = 8081;
// Создаём HTTP-сервер
const httpServer = (0, http_1.createServer)((req, res) => {
    // Новый эндпоинт: GET /api/metrics/:chargePointId?from=...&to=...
    if (req.method === 'GET' && req.url?.startsWith('/api/metrics/')) {
        try {
            const parsedUrl = new url_1.URL(req.url, `http://localhost:${PORT}`); // Парсим URL
            const pathParts = parsedUrl.pathname.split('/'); // Разбиваем /api/metrics/CP_001
            const chargePointId = pathParts[3]; // Извлекаем :chargePointId
            if (!chargePointId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing chargePointId in path' }));
                return;
            }
            const searchParams = parsedUrl.searchParams; // Query-параметры
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            // Асинхронный расчёт метрик
            // Асинхронный расчёт (внутри if для /api/metrics)
            (async () => {
                try {
                    // Валидация и парсинг дат с fallback
                    let fromDate;
                    let toDate;
                    if (from) {
                        const parsedFrom = new Date(from);
                        fromDate = isNaN(parsedFrom.getTime()) ? new Date('1970-01-01T00:00:00.000Z') : parsedFrom;
                    }
                    else {
                        fromDate = new Date('1970-01-01T00:00:00.000Z');
                    }
                    if (to) {
                        const parsedTo = new Date(to);
                        toDate = isNaN(parsedTo.getTime()) ? new Date() : parsedTo;
                    }
                    else {
                        toDate = new Date();
                    }
                    logger_1.logger.debug(`Parsed dates: from=${fromDate.toISOString()}, to=${toDate.toISOString()}`); // Для отладки
                    const totalKWh = await exports.connectionManager.getTotalKWh(chargePointId, fromDate, toDate);
                    const cost = totalKWh * 0.1; // Тариф
                    logger_1.logger.info(`Metrics query for ${chargePointId}: from ${fromDate.toISOString()} to ${toDate.toISOString()}, totalKWh=${totalKWh.toFixed(2)}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        chargePointId,
                        totalKWh: totalKWh.toFixed(2),
                        cost: cost.toFixed(2),
                        from: fromDate.toISOString(),
                        to: toDate.toISOString()
                    }));
                }
                catch (err) {
                    logger_1.logger.error(`Metrics query error for ${chargePointId}: ${err}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error during calculation' }));
                }
            })();
            return; // Обработка завершена, не падаем в дефолт
        }
        catch (parseErr) {
            logger_1.logger.error(`URL parse error in metrics endpoint: ${parseErr}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid URL format' }));
            return;
        }
    }
    // Ваш существующий дефолтный обработчик
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
    await (0, mongoose_1.connectDB)();
    logger_1.logger.info('[HTTP_SERVER] Starting HTTP server...');
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT}`);
    });
})();
