import { logger } from '../logger';
import { connectClient } from './wsClient';
import { ClientManager } from './connectionManager';
import { sendHeartbeat } from './messageSender';

export const manager = new ClientManager();  // Экспорт для импортов

async function main() {
  try {
    const ws = await connectClient();  // Connect + boot в on('open')
    logger.info('Client ready — boot sent');
  } catch (err) {
    logger.error(`Client error: ${err}`);
  }
}

main();