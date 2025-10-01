"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoteStopTransaction = handleRemoteStopTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleRemoteStopTransaction(req, chargePointId, ws) {
    try {
        await mongoose_2.Transaction.findOneAndUpdate({ id: req.transactionId }, { stopTime: new Date(), remote: true }, { upsert: false });
        await mongoose_1.Log.create({ action: 'RemoteStopTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Remote stop for ${chargePointId}: tx ${req.transactionId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in RemoteStopTransaction: ${err}`);
        return { status: 'Rejected' };
    }
}
