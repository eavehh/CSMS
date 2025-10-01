"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUnlockConnector = handleUnlockConnector;
const mongoose_1 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleUnlockConnector(req, chargePointId, ws) {
    try {
        await mongoose_1.Log.create({ action: 'UnlockConnector', chargePointId, payload: req });
        logger_1.logger.info(`Unlock connector ${req.connectorId} for ${chargePointId}`);
        return {
            status: 'Unlocked'
        }; // Или 'Locked'
    }
    catch (err) {
        logger_1.logger.error(`Error in UnlockConnector: ${err}`);
        return {
            status: 'UnlockFailed'
        };
    }
}
