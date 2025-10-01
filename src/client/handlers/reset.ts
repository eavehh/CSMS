import { ResetRequest } from '../../../types/1.6/Reset';
import { ResetResponse } from '../../../types/1.6/ResetResponse';
import { ChargePoint } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleReset(req: ResetRequest, chargePointId: string, ws: WebSocket): Promise<ResetResponse> {
  try {
    await ChargePoint.findOneAndUpdate(
      { id: chargePointId },
      { status: 'Resetting', resetType: req.type },  // Soft/Hard
      { upsert: true }
    );
    await Log.create({ action: 'Reset', chargePointId, payload: req });
    logger.info(`Reset for ${chargePointId}: type ${req.type}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in Reset: ${err}`);
    return { status: 'Rejected' };
  }
}