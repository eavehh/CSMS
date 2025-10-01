"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetDiagnostics = handleGetDiagnostics;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleGetDiagnostics(req, chargePointId, ws) {
    try {
        await mongoose_1.Diagnostics.findOneAndUpdate({ chargePointId }, { fileName: req.location, status: 'Idle' }, { upsert: true });
        await mongoose_2.Log.create({ action: 'GetDiagnostics', chargePointId, payload: req });
        logger_1.logger.info(`Get diagnostics for ${chargePointId}: ${req.location}`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in GetDiagnostics: ${err}`);
        return {};
    }
}
