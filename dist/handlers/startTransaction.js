"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStartTransaction = handleStartTransaction;
const mongoose_1 = require("../db/mongoose");
const mongoose_2 = require("../db/mongoose");
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
async function handleStartTransaction(req, chargePointId, ws) {
    const transId = (0, uuid_1.v4)();
    try {
        const newTx = new mongoose_1.Transaction({
            id: transId,
            chargePointId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            connectorId: req.connectorId,
            meterStart: req.meterStart
        });
        await newTx.save();
        await mongoose_2.Log.create({ action: 'StartTransaction', chargePointId, payload: req });
        logger_1.logger.info(`Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);
        return { transactionId: Number(transId), idTagInfo: { status: 'Accepted' } };
    }
    catch (err) {
        logger_1.logger.error(`Error in StartTransaction: ${err}`);
        return {
            idTagInfo: { status: 'Invalid' }, transactionId: Number(transId)
        };
    }
}
