"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpdateFirmware = handleUpdateFirmware;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleUpdateFirmware(req, chargePointId, ws) {
    try {
        await mongoose_1.Firmware.findOneAndUpdate({ chargePointId }, { firmwareVersion: Date.now(),
            status: 'Downloaded' }, { upsert: true });
        await mongoose_2.Log.create({ action: 'UpdateFirmware', chargePointId, payload: req });
        logger_1.logger.info(`Update firmware for ${chargePointId}: version ${Date.now()}`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in UpdateFirmware: ${err}`);
        return {};
    }
}
