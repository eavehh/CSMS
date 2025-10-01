import { ClearChargingProfileRequest } from '../../../types/1.6/ClearChargingProfile';
import { ClearChargingProfileResponse } from '../../../types/1.6/ClearChargingProfileResponse';
import { ChargingProfile } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleClearChargingProfile(req: ClearChargingProfileRequest, chargePointId: string, ws: WebSocket): Promise<ClearChargingProfileResponse> {
    try {
        await ChargingProfile.deleteMany({ chargePointId, id: req.chargingProfileId });  // Удали по ID
        await Log.create({ action: 'ClearChargingProfile', chargePointId, payload: req });
        logger.info(`Clear profile ${req.chargingProfileId} for ${chargePointId}: ${req.status}`);
        return { status: req.status || 'Accepted' };
    } catch (err) {
        logger.error(`Error in ClearChargingProfile: ${err}`);
        return { status: 'Rejected' };
    }
}