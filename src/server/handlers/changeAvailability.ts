import { ChangeAvailabilityRequest } from '../../server/types/1.6/ChangeAvailability';
import { ChangeAvailabilityResponse } from '../../server/types/1.6/ChangeAvailabilityResponse';
import { ChargePoint } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';
import { connectionManager } from '../index'


export async function handleChangeAvailability(req: ChangeAvailabilityRequest, chargePointId: string, ws: WebSocket): Promise<ChangeAvailabilityResponse> {
    try {
        await ChargePoint.findOneAndUpdate(
            { id: chargePointId },
            { availabilityStatus: req.type },  // Operative/Inoperative
            { upsert: true }
        );
        await Log.create({ action: 'ChangeAvailability', chargePointId, payload: req });
        logger.info(`Change availability for ${chargePointId}, connector ${req.connectorId}: ${req.type}`);
        
        connectionManager.updateConnectorState(chargePointId, req.connectorId, req.type === 'Operative' ? 'Available' : 'Unavailable')
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`Error in ChangeAvailability: ${err}`);
        return { status: 'Rejected' };
    }
}