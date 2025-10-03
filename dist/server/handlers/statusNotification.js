"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStatusNotification = handleStatusNotification;
const logger_1 = require("../../logger");
async function handleStatusNotification(payload, chargePointId, ws) {
    const { connectorId, status, errorCode, timestamp } = payload;
    logger_1.logger.info(`[StatusNotification] ${chargePointId} connector ${connectorId} - ${status}`);
    // без внешнего триггера
    return {}; // Корректный пустой ответ
}
