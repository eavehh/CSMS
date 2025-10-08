import { v4 as uuidv4 } from 'uuid';
import { ConnectionManager } from '../server/connectionManager';
import { logger } from '../logger';

export function sendRemoteMessage(
    connectionManager: ConnectionManager,
    chargePointId: string,
    action: string,
    payload: any
) {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger.error(`[remoteControl] Нет связи с ${chargePointId}`);
        return;
    }

    const uniqueId = uuidv4();
    const message = [2, uniqueId, action, payload];

    ws.send(JSON.stringify(message));
    logger.info(`[remoteControl] Отправил ${action} на ${chargePointId}: ${JSON.stringify(payload)}`);
}
