import WebSocket from 'ws';
import * as http from 'http';
import { logger } from '../logger.js';
import { handleResponse } from './responseHandler';
import { ClientManager } from './connectionManager'
import { connectClient } from './wsClient'

export const manager = new ClientManager()

const server = http.createServer();

const wsServer = new WebSocket.Server({ server })

server.listen(8001, () => {
    logger.info(`http on 8000`)
})