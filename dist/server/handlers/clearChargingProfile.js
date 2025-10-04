"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleClearChargingProfile = handleClearChargingProfile;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleClearChargingProfile(req, chargePointId, ws) {
    try {
        await mongoose_1.ChargingProfile.deleteMany({ chargePointId, id: req.id }); // Удали по ID
        await mongoose_2.Log.create({ action: 'ClearChargingProfile', chargePointId, payload: req });
        logger_1.logger.info(`Clear profile ${req.id} for ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in ClearChargingProfile: ${err}`);
        return { status: 'Unknown' };
    }
}
