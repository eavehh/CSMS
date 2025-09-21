import express from 'express';  
import { Server } from 'http';
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from './logger';

const app = express();
const PORT = 8000;


const httpServer = Server(app);

const connectionManager = new ConnectionManager();
const wsServer = new WsServer(httpServer, connectionManager);

// Graceful shutdown (чтобы сервер красиво закрывался Ctrl+C)
process.on('SIGINT', () => {
    logger?.info('Shutting down...');
    httpServer.close(() => process.exit(0));
});

httpServer.listen(PORT, () => {
    logger?.info(`CSMS Server on port ${PORT}`);  // Или console.log
});