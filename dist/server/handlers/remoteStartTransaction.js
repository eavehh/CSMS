"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoteStartTransaction = handleRemoteStartTransaction;
const mongoose_1 = require("../../db/mongoose");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
async function handleRemoteStartTransaction(req, chargePointId, ws) {
    try {
        const repo = require('../../db/postgres').AppDataSource.getRepository(Transaction_1.Transaction);
        let tx = await repo.findOneBy({ chargePointId, idTag: req.idTag });
        if (!tx) {
            tx = repo.create({
                chargePointId,
                idTag: req.idTag,
                startTime: new Date(),
                remote: true
            });
        }
        else {
            tx.startTime = new Date();
            tx.remote = true;
        }
        await repo.save(tx);
        await mongoose_1.Log.create({ action: 'RemoteStartTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Remote start for ${chargePointId}: idTag ${req.idTag}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in RemoteStartTransaction: ${err}`);
        return { status: 'Rejected' };
    }
}
