"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChangeConfiguration = handleChangeConfiguration;
const logger_1 = require("../server/logger");
async function handleChangeConfiguration(req, chargePointId, ws) {
    logger_1.logger.info(`ChargeConfiguration from ${chargePointId}`);
    // DB
    return {
        status: "Accepted" // 
    };
}
