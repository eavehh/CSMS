import { RemoteStopTransactionRequest } from '../../../types/1.6/RemoteStopTransaction';
import { RemoteStopTransactionResponse } from '../../../types/1.6/RemoteStopTransactionResponse';
import { Log } from '../../db/mongoose';
import { Transaction } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleRemoteStopTransaction(req: RemoteStopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<RemoteStopTransactionResponse> {
  try {
    await Transaction.findOneAndUpdate(
      { id: req.transactionId },
      { stopTime: new Date(), remote: true },
      { upsert: false }
    );
    await Log.create({ action: 'RemoteStopTransaction', chargePointId, payload: req });
    logger.info(`Remote stop for ${chargePointId}: tx ${req.transactionId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in RemoteStopTransaction: ${err}`);
    return { status: 'Rejected' };
  }
}