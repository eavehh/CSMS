"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoteStartTransaction = handleRemoteStartTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleRemoteStartTransaction(req, chargePointId, ws) {
    try {
        await mongoose_2.Transaction.findOneAndUpdate({ chargePointId, idTag: req.idTag }, { startTime: new Date(), remote: true }, { upsert: true });
        await mongoose_1.Log.create({ action: 'RemoteStartTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Remote start for ${chargePointId}: idTag ${req.idTag}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in RemoteStartTransaction: ${err}`);
        return { status: 'Rejected' };
    }
}
