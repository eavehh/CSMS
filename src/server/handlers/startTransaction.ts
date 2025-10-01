import { StartTransactionRequest } from '../types/1.6/StartTransaction';
import { StartTransactionResponse } from '../types/1.6/StartTransactionResponse';
import { Transaction } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleStartTransaction(req: StartTransactionRequest, chargePointId: string, ws: WebSocket): Promise<StartTransactionResponse> {
    const transId = uuidv4();
    try {
        const newTx = new Transaction({
            id: transId,
            chargePointId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            connectorId: req.connectorId,
            meterStart: req.meterStart
        });
        await newTx.save();
        await Log.create({ action: 'StartTransaction', chargePointId, payload: req });
        logger.info(`Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);
        return { transactionId: Number(transId), idTagInfo: { status: 'Accepted' } };
    } catch (err) {
        logger.error(`Error in StartTransaction: ${err}`);
        return {
            idTagInfo: { status: 'Invalid' }, transactionId: Number(transId)
        };
    }
}