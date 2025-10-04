import { SetChargingProfileRequest } from '../../server/types/1.6/SetChargingProfile';
import { SetChargingProfileResponse } from '../../server/types/1.6/SetChargingProfileResponse';
import { ChargingProfile } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleSetChargingProfile(req: SetChargingProfileRequest, chargePointId: string, ws: WebSocket): Promise<SetChargingProfileResponse> {
  try {
    const profile = new ChargingProfile({
      id: req.csChargingProfiles.chargingProfileId,
      chargePointId,
      stackLevel: req.csChargingProfiles.stackLevel,
      chargingProfilePurpose: req.csChargingProfiles.chargingProfilePurpose,
      chargingProfileKind: req.csChargingProfiles.chargingProfileKind,
      chargingSchedule: req.csChargingProfiles.chargingSchedule,
      status: 'Accepted'
    });
    await profile.save();
    await Log.create({ action: 'SetChargingProfile', chargePointId, payload: req });
    logger.info(`Set profile ${req.csChargingProfiles.chargingProfileId} for ${chargePointId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in SetChargingProfile: ${err}`);
    return { status: 'Rejected' };
  }
}