"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetLocalListVersion = handleGetLocalListVersion;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleGetLocalListVersion(req, chargePointId, ws) {
    try {
        const list = await mongoose_1.LocalList.findOne({ chargePointId }).sort({ updatedAt: -1 });
        const version = list ? list.listVersion : 0;
        await mongoose_2.Log.create({ action: 'GetLocalListVersion', chargePointId, payload: req });
        logger_1.logger.info(`Get local list version for ${chargePointId}: ${version}`);
        return { listVersion: version };
    }
    catch (err) {
        logger_1.logger.error(`Error in GetLocalListVersion: ${err}`);
        return { listVersion: 0 };
    }
}
