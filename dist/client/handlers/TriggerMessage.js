"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTriggerMessage = handleTriggerMessage;
const mongoose_1 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleTriggerMessage(req, chargePointId, ws) {
    try {
        await mongoose_1.Log.create({ action: 'TriggerMessage', chargePointId, payload: req });
        logger_1.logger.info(`Trigger ${req.requestedMessage} for ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in TriggerMessage: ${err}`);
        return { status: 'Rejected' };
    }
}
