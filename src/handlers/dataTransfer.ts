import { DataTransferRequest } from '../../types/1.6/DataTransfer';
import { DataTransferResponse } from '../../types/1.6/DataTransferResponse';
import { Log } from '../db/mongoose';
import { logger } from '../logger';
import WebSocket from 'ws';

export async function handleDataTransfer(req: DataTransferRequest, chargePointId: string, ws: WebSocket): Promise<DataTransferResponse> {
    try {
        await Log.create({ action: 'DataTransfer', chargePointId, payload: req });
        logger.info(`DataTransfer from ${chargePointId}: vendor ${req.vendorId}, data ${req.data}`);
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`Error in DataTransfer: ${err}`);
        return { status: 'Rejected' };
    }
}