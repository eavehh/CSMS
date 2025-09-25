import express from 'express';
import { Server } from 'http';
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from './logger';
import { connectDB } from "../db/mongoose"

const app = express();
const PORT = 8000;


const httpServer = Server(app);

const connectionManager = new ConnectionManager();
const wsServer = new WsServer(httpServer, connectionManager);

// Graceful shutdown (чтобы сервер красиво закрывался)
process.on('SIGINT', () => {
    logger?.info('Shutting down...');
    httpServer.close(() => process.exit(0));
});

connectDB() //async

httpServer.listen(PORT, () => {
    logger?.info(`CSMS Server on port ${PORT}`);  // Или console.log
});