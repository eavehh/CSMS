import { TriggerMessageRequest } from '../../server/types/1.6/TriggerMessage';
import { TriggerMessageResponse } from '../../server/types/1.6/TriggerMessageResponse';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleTriggerMessage(req: TriggerMessageRequest, chargePointId: string, ws: WebSocket): Promise<TriggerMessageResponse> {
  try {
    await Log.create({ action: 'TriggerMessage', chargePointId, payload: req });
    logger.info(`Trigger ${req.requestedMessage} for ${chargePointId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in TriggerMessage: ${err}`);
    return { status: 'Rejected' };
  }
}