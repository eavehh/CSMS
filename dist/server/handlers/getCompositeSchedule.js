"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetCompositeSchedule = handleGetCompositeSchedule;
const mongoose_1 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleGetCompositeSchedule(req, chargePointId, ws) {
    try {
        // Логика: верни композитное расписание (из DB или default)
        await mongoose_1.Log.create({ action: 'GetCompositeSchedule', chargePointId, payload: req });
        logger_1.logger.info(`Get composite schedule for ${chargePointId}: duration ${req.duration}`);
        return {
            status: 'Accepted',
            connectorId: req.connectorId,
        };
    }
    catch (err) {
        logger_1.logger.error(`Error in GetCompositeSchedule: ${err}`);
        return { status: 'Rejected' };
    }
}
