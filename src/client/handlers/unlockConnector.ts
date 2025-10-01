import { UnlockConnectorRequest } from '../../../types/1.6/UnlockConnector';
import { UnlockConnectorResponse } from '../../../types/1.6/UnlockConnectorResponse';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleUnlockConnector(req: UnlockConnectorRequest, chargePointId: string, ws: WebSocket): Promise<UnlockStatus> {
    try {
        await Log.create({ action: 'UnlockConnector', chargePointId, payload: req });
        logger.info(`Unlock connector ${req.connectorId} for ${chargePointId}`);
        return 'Unlocked';  // Или 'Locked'
    } catch (err) {
        logger.error(`Error in UnlockConnector: ${err}`);
        return 'Locked';
    }
}