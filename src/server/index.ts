// src/server/index.ts
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from '../logger';
import { connectDB } from '../db/mongoose';

const PORT = 8000;

const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
        // можно отдать 200 OK для проверки живости
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('CSMS WebSocket endpoint: ws://localhost:' + PORT + '/ocpp\n');
    }
);

export const connectionManager = new ConnectionManager();
new WsServer(httpServer, connectionManager);

process.on('SIGINT', () => {
    logger.info('Shutting down...');
    httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

(async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        logger.info(`CSMS Server listening on port ${PORT} (no Express)`);
    });
})();