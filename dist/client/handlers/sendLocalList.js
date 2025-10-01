"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSendLocalList = handleSendLocalList;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const remoteControl_1 = require("../../utils/remoteControl");
const logger_1 = require("../../logger");
const server_1 = require("../../server"); // Или передай param
async function handleSendLocalList(req, chargePointId, ws) {
    try {
        await mongoose_1.LocalList.findOneAndUpdate({ chargePointId }, {
            chargePointId,
            listVersion: req.listVersion,
            localList: req.localAuthorizationList || [],
            updatedAt: new Date()
        }, { upsert: true });
        // Отправь зарядке (сервер → клиент)
        (0, remoteControl_1.sendRemoteMessage)(server_1.connectionManager, chargePointId, 'SendLocalList', {
            listVersion: req.listVersion,
            localList: req.localAuthorizationList || []
        });
        await mongoose_2.Log.create({ action: 'SendLocalList', chargePointId, payload: req });
        logger_1.logger.info(`Send LocalList v${req.listVersion} to ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in SendLocalList: ${err}`);
        return { status: 'Failed' };
    }
}
