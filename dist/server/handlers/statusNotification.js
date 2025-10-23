"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStatusNotification = handleStatusNotification;
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStatusNotification(payload, chargePointId, ws) {
    const { connectorId, status, errorCode, timestamp } = payload;
    // 🔥 Динамически создаём состояние коннектора, если его нет
    index_1.connectionManager.updateConnectorState(chargePointId, payload.connectorId, payload.status, undefined, payload.errorCode);
    index_1.connectionManager.broadcastEvent('connector.status.changed', { stationId: chargePointId, connectorId, status, errorCode });
    logger_1.logger.info(`[StatusNotification] ${chargePointId} connector ${connectorId} - ${status}${errorCode ? ` (error: ${errorCode})` : ''}`);
    // без внешнего триггера
    return {}; // Корректный пустой ответ
}
