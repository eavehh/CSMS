"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRemoteMessage = sendRemoteMessage;
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
function sendRemoteMessage(connectionManager, chargePointId, action, payload) {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger_1.logger.error(`Нет связи с ${chargePointId}`);
        return;
    }
    const uniqueId = (0, uuid_1.v4)();
    const message = [2, uniqueId, action, payload];
    ws.send(JSON.stringify(message));
    logger_1.logger.info(`Отправил ${action} на ${chargePointId}: ${JSON.stringify(payload)}`);
}
