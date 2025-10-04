"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReset = handleReset;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleReset(req, chargePointId, ws) {
    try {
        await mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, { status: 'Resetting', resetType: req.type }, // Soft/Hard
        { upsert: true });
        await mongoose_2.Log.create({ action: 'Reset', chargePointId, payload: req });
        logger_1.logger.info(`Reset for ${chargePointId}: type ${req.type}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in Reset: ${err}`);
        return { status: 'Rejected' };
    }
}
