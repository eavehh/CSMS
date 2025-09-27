"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSendLocalList = handleSendLocalList;
const mongoose_1 = require("../db/mongoose");
const RemoteControl_1 = require("../utils/RemoteControl");
const logger_1 = require("../server/logger");
async function handleSendLocalList(req, chargePointId, ws, connectionManager) {
    try {
        await mongoose_1.LocalList.findOneAndUpdate({ chargePointId }, { version: req.listVersion, updatedAt: new Date() }, { upsert: true });
        (0, RemoteControl_1.sendRemoteMessage)(connectionManager, chargePointId, 'SendLocalList', { listVersion: req.listVersion, localList: req.localAuthorizationList || [] });
        logger_1.logger.info(`Отправил список карт версии ${req.listVersion} на ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Ошибка в sendLocalList: ${err.message}`);
        return { status: 'Failed' };
    }
}
