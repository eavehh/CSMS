"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDiagnosticsStatusNotification = handleDiagnosticsStatusNotification;
const logger_1 = require("../server/logger");
async function handleDiagnosticsStatusNotification(req, chargePointId, ws) {
    logger_1.logger.info(`Diagnostics from ${chargePointId}: ${req.status}`);
    return {}; // Пустой ответ
}
