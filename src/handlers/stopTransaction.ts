import { StopTransactionRequest } from '../../types/1.6/StopTransaction';
import { StopTransactionResponse } from '../../types/1.6/StopTransactionResponse';
import { Transaction } from '../db/mongoose';
import { Log } from '../db/mongoose';
import { logger } from '../logger';
import WebSocket from 'ws';

export async function handleStopTransaction(req: StopTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StopTransactionResponse> {
  try {
    const tx = await Transaction.findOneAndUpdate(
      { id: req.transactionId },
      {
        stopTime: new Date(req.timestamp),
        meterStop: req.meterStop,
        transactionData: req.transactionData
      },
      { new: true }
    );
    if (!tx) {
      logger.error(`Tx not found: ${req.transactionId}`);
      return { idTagInfo: { status: 'Invalid' } };
    }
    await Log.create({ action: 'StopTransaction', chargePointId, payload: req });
    logger.info(`Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}`);
    return { idTagInfo: { status: 'Accepted' } };
  } catch (err) {
    logger.error(`Error in StopTransaction: ${err}`);
    return { idTagInfo: { status: 'Blocked' } };
  }
}