"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSetChargingProfile = handleSetChargingProfile;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleSetChargingProfile(req, chargePointId, ws) {
    try {
        const profile = new mongoose_1.ChargingProfile({
            id: req.csChargingProfiles.chargingProfileId,
            chargePointId,
            stackLevel: req.csChargingProfiles.stackLevel,
            chargingProfilePurpose: req.csChargingProfiles.chargingProfilePurpose,
            chargingProfileKind: req.csChargingProfiles.chargingProfileKind,
            chargingSchedule: req.csChargingProfiles.chargingSchedule,
            status: 'Accepted'
        });
        await profile.save();
        await mongoose_2.Log.create({ action: 'SetChargingProfile', chargePointId, payload: req });
        logger_1.logger.info(`Set profile ${req.csChargingProfiles.chargingProfileId} for ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in SetChargingProfile: ${err}`);
        return { status: 'Rejected' };
    }
}
