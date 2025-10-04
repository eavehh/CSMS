"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStatusNotification = handleStatusNotification;
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStatusNotification(payload, chargePointId, ws) {
    const { connectorId, status, errorCode, timestamp } = payload;
    index_1.connectionManager.updateConnectorState(chargePointId, payload.connectorId, payload.status, undefined, payload.errorCode);
    logger_1.logger.info(`[StatusNotification] ${chargePointId} connector ${connectorId} - ${status}`);
    // без внешнего триггера
    return {}; // Корректный пустой ответ
}
