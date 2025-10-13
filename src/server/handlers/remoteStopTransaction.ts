import { RemoteStopTransactionRequest } from '../../server/types/1.6/RemoteStopTransaction';
import { RemoteStopTransactionResponse } from '../../server/types/1.6/RemoteStopTransactionResponse';
import { Log } from '../../db/mongoose';
import { Transaction } from '../../db/entities/Transaction';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleRemoteStopTransaction(req: RemoteStopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<RemoteStopTransactionResponse> {
  try {
    const repo = require('../../db/postgres').AppDataSource.getRepository(Transaction);
    const tx = await repo.findOneBy({ id: req.transactionId });
    if (tx) {
      tx.stopTime = new Date();
      (tx as any).remote = true;
      await repo.save(tx);
    }
    await Log.create({ action: 'RemoteStopTransaction', chargePointId, payload: req });
    logger.info(`Remote stop for ${chargePointId}: tx ${req.transactionId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in RemoteStopTransaction: ${err}`);
    return { status: 'Rejected' };
  }
}