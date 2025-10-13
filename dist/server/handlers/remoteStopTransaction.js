"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoteStopTransaction = handleRemoteStopTransaction;
const mongoose_1 = require("../../db/mongoose");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
async function handleRemoteStopTransaction(req, chargePointId, ws) {
    try {
        const repo = require('../../db/postgres').AppDataSource.getRepository(Transaction_1.Transaction);
        const tx = await repo.findOneBy({ id: req.transactionId });
        if (tx) {
            tx.stopTime = new Date();
            tx.remote = true;
            await repo.save(tx);
        }
        await mongoose_1.Log.create({ action: 'RemoteStopTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Remote stop for ${chargePointId}: tx ${req.transactionId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in RemoteStopTransaction: ${err}`);
        return { status: 'Rejected' };
    }
}
