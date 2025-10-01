"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFirmwareStatusNotification = handleFirmwareStatusNotification;
const mongoose_1 = require("../db/mongoose");
const mongoose_2 = require("../db/mongoose");
const logger_1 = require("../logger");
async function handleFirmwareStatusNotification(req, chargePointId, ws) {
    try {
        await mongoose_1.Firmware.findOneAndUpdate({ chargePointId }, { status: req.status, firmwareVersion: Date.now() }, { upsert: true });
        await mongoose_2.Log.create({ action: 'FirmwareStatusNotification', chargePointId, payload: req });
        logger_1.logger.info(`Firmware status from ${chargePointId}: ${req.status}`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in FirmwareStatus: ${err}`);
        return {};
    }
}
