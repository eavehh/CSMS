"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBootNotification = handleBootNotification;
const logger_1 = require("../server/logger");
async function handleBootNotification(req, chargePointId, ws) {
    logger_1.logger.info(`Boot from ${chargePointId}: ${req.chargePointVendor} ${req.chargePointModel}`);
    // DB 
    return {
        currentTime: new Date().toISOString(),
        interval: 60, // Heartbeat каждую минуту
        status: 'Accepted'
    };
}
