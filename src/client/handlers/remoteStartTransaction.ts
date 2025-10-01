import { RemoteStartTransactionRequest } from '../../server/types/1.6/RemoteStartTransaction';
import { RemoteStartTransactionResponse } from '../../server/types/1.6/RemoteStartTransactionResponse';
import { Log } from '../../db/mongoose';
import { Transaction } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleRemoteStartTransaction(req: RemoteStartTransactionRequest, chargePointId: string, ws: WebSocket): Promise<RemoteStartTransactionResponse> {
  try {
    await Transaction.findOneAndUpdate(
      { chargePointId, idTag: req.idTag },
      { startTime: new Date(), remote: true },
      { upsert: true }
    );
    await Log.create({ action: 'RemoteStartTransaction', chargePointId, payload: req });
    logger.info(`Remote start for ${chargePointId}: idTag ${req.idTag}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in RemoteStartTransaction: ${err}`);
    return { status: 'Rejected' };
  }
}