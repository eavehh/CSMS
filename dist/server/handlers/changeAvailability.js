"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChangeAvailability = handleChangeAvailability;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../index");
async function handleChangeAvailability(req, chargePointId, ws) {
    try {
        await mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, { availabilityStatus: req.type }, // Operative/Inoperative
        { upsert: true });
        await mongoose_2.Log.create({ action: 'ChangeAvailability', chargePointId, payload: req });
        logger_1.logger.info(`Change availability for ${chargePointId}, connector ${req.connectorId}: ${req.type}`);
        index_1.connectionManager.updateConnectorState(chargePointId, req.connectorId, req.type === 'Operative' ? 'Available' : 'Unavailable');
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in ChangeAvailability: ${err}`);
        return { status: 'Rejected' };
    }
}
