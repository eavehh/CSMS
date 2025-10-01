"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDataTransfer = handleDataTransfer;
const mongoose_1 = require("../db/mongoose");
const logger_1 = require("../logger");
async function handleDataTransfer(req, chargePointId, ws) {
    try {
        await mongoose_1.Log.create({ action: 'DataTransfer', chargePointId, payload: req });
        logger_1.logger.info(`DataTransfer from ${chargePointId}: vendor ${req.vendorId}, data ${req.data}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in DataTransfer: ${err}`);
        return { status: 'Rejected' };
    }
}
