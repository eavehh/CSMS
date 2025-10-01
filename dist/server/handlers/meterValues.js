"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMeterValues = handleMeterValues;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleMeterValues(req, chargePointId, ws) {
    try {
        // Обнови tx energy, если txId
        if (req.transactionId) {
            await mongoose_1.Transaction.findOneAndUpdate({ id: req.transactionId }, { energy: req.meterValue[0]?.sampledValue[0]?.value }, // Пример
            { upsert: true });
        }
        await mongoose_2.Log.create({ action: 'MeterValues', chargePointId, payload: req });
        logger_1.logger.info(`Meter from ${chargePointId}: ${req.meterValue[0]?.sampledValue[0]?.value} kWh`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}
