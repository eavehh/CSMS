"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAuthorize = handleAuthorize;
const logger_1 = require("../server/logger");
async function handleAuthorize(req, chargePointId, ws) {
    logger_1.logger.info(`Authorize from ${chargePointId}: ${req.idTag}`);
    // DB 
    return {
        idTagInfo: {
            status: "Accepted"
        }
    };
}
