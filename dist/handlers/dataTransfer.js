"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDataTransfer = handleDataTransfer;
const mongoose_1 = require("../db/mongoose"); // DB для лога
const logger_1 = require("../server/logger");
async function handleDataTransfer(req, chargePointId, ws) {
    try {
        await mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, { $set: { lastDataTransfer: { vendorId: req.vendorId, data: req.data } } }, { upsert: true });
        logger_1.logger.info(`DataTransfer from ${chargePointId}: vendor ${req.vendorId}, data ${req.data}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`DB error in DataTransfer: ${err.message}`);
        return { status: 'Rejected' };
    }
}
