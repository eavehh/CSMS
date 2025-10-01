"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChangeConfiguration = handleChangeConfiguration;
const mongoose_1 = require("../../db/mongoose"); // DB для config
const logger_1 = require("../../logger");
async function handleChangeConfiguration(req, chargePointId, ws) {
    try {
        const configurationKey = req.configurationKey || [];
        for (const conf of configurationKey) {
            await mongoose_1.Config.findOneAndUpdate({ chargePointId, key: conf.key }, { chargePointId, key: conf.key, value: conf.value, readonly: false }, { upsert: true });
        }
        logger_1.logger.info(`Change config on ${chargePointId}: keys ${configurationKey.map((k) => k.key).join(',')}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`DB error in ChangeConfiguration: ${err.message}`);
        return { status: 'Rejected' };
    }
}
