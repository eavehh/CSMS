"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionManager = void 0;
// src/server/index.ts
const http_1 = require("http");
const wsServer_1 = require("./wsServer");
const connectionManager_1 = require("./connectionManager");
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
const PORT = 8000;
const httpServer = (0, http_1.createServer)((req, res) => {
    // можно отдать 200 OK для проверки живости
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CSMS WebSocket endpoint: ws://localhost:' + PORT + '/ocpp\n');
});
exports.connectionManager = new connectionManager_1.ConnectionManager();
new wsServer_1.WsServer(httpServer, exports.connectionManager);
process.on('SIGINT', () => {
    logger_1.logger.info('Shutting down...');
    httpServer.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
});
(async () => {
    await (0, mongoose_1.connectDB)();
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`CSMS Server listening on port ${PORT} (no Express)`);
    });
})();
