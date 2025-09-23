"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStatusNotification = handleStatusNotification;
const logger_1 = require("../server/logger");
async function handleStatusNotification(req, chargePointId, ws) {
    logger_1.logger.info(`Status from ${chargePointId}, connector ${req.connectorId} ${req.status}`);
    return {};
}
