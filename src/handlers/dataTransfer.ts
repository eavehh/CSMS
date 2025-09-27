import { DataTransferRequest } from '../../types/1.6/DataTransfer';
import { DataTransferResponse } from '../../types/1.6/DataTransferResponse';
import { ChargePoint } from '../db/mongoose';  // DB для лога
import { logger } from '../server/logger';
import WebSocket from 'ws';

export async function handleDataTransfer(req: DataTransferRequest, chargePointId: string, ws: WebSocket): Promise<DataTransferResponse> {
    try {
        await ChargePoint.findOneAndUpdate(
            { id: chargePointId },
            { $set: { lastDataTransfer: { vendorId: req.vendorId, data: req.data } } },
            { upsert: true }
        );
        logger.info(`DataTransfer from ${chargePointId}: vendor ${req.vendorId}, data ${req.data}`);
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`DB error in DataTransfer: ${err.message}`);
        return { status: 'Rejected' };
    }
}