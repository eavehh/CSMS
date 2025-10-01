"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRemoteMessage = sendRemoteMessage;
exports.sendRemoteStart = sendRemoteStart;
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
function sendRemoteMessage(connectionManager, chargePointId, action, payload) {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger_1.logger.error(`No connection to charge point ${chargePointId}`);
        return;
    }
    const message = [2, (0, uuid_1.v4)(), action, payload];
    ws.send(JSON.stringify(message));
    logger_1.logger.info(`Sent ${action} to ${chargePointId}`);
}
function sendRemoteStart(connectionManager, chargePointId) {
    const payload = { idTag: 'TAG001', connectorId: 1 };
    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStartTransaction', payload);
}
