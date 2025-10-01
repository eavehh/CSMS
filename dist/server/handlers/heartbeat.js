"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHeartbeat = handleHeartbeat;
const logger_1 = require("../../logger");
async function handleHeartbeat(req, chargePointId, ws) {
    logger_1.logger.info(`heartbeat from ${chargePointId}`);
    return {
        currentTime: new Date().toISOString()
    };
}
