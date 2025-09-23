"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const wsServer_1 = require("./wsServer");
const connectionManager_1 = require("./connectionManager");
const logger_1 = require("./logger");
const app = (0, express_1.default)();
const PORT = 8000;
const httpServer = (0, http_1.Server)(app);
const connectionManager = new connectionManager_1.ConnectionManager();
const wsServer = new wsServer_1.WsServer(httpServer, connectionManager);
// Graceful shutdown (чтобы сервер красиво закрывался)
process.on('SIGINT', () => {
    logger_1.logger?.info('Shutting down...');
    httpServer.close(() => process.exit(0));
});
httpServer.listen(PORT, () => {
    logger_1.logger?.info(`CSMS Server on port ${PORT}`); // Или console.log
});
