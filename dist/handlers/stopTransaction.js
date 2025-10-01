"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const mongoose_1 = require("../db/mongoose");
const mongoose_2 = require("../db/mongoose");
const logger_1 = require("../logger");
async function handleStopTransaction(req, chargePointId, ws) {
    try {
        const tx = await mongoose_1.Transaction.findOneAndUpdate({ id: req.transactionId }, {
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            transactionData: req.transactionData
        }, { new: true });
        if (!tx) {
            logger_1.logger.error(`Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        await mongoose_2.Log.create({ action: 'StopTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Stop tx from ${chargePointId}: id ${req.transactionId}, energy ${req.meterStop}`);
        return { idTagInfo: { status: 'Accepted' } };
    }
    catch (err) {
        logger_1.logger.error(`Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
