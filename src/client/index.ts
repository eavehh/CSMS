import { logger } from '../logger';
import { connectClient } from './wsClient';
import { ClientManager } from './connectionManager';
import { demonstrateOCPPFunctionality } from './test'

export const manager = new ClientManager();  // Экспорт для импортов

const chargePointId = process.argv[2] || 'CP_001';  // ID из arg

async function main() {
  try {
    const ws = await connectClient();  // Connect + boot в on('open')
//    demonstrateOCPPFunctionality()
    logger.info(`Client ${chargePointId} ready`);
  } catch (err) {
    logger.error(`Client error: ${err}`);
  }
}

main();