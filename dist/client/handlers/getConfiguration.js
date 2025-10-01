"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetConfiguration = handleGetConfiguration;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleGetConfiguration(req, chargePointId, ws) {
    try {
        let configs;
        if (req.key && req.key.length > 0) {
            configs = await mongoose_1.ConfigurationKey.find({ chargePointId, key: { $in: req.key } });
        }
        else {
            configs = await mongoose_1.ConfigurationKey.find({ chargePointId });
        }
        const responseKey = configs.map(c => ({
            key: c.key,
            readonly: c.readonly,
            value: c.value || undefined // Фикс: null → undefined, тип совпадёт
        })).filter(c => c.value !== undefined || c.readonly); // Опционально: фильтр, если value null — пропусти
        await mongoose_2.Log.create({ action: 'GetConfiguration', chargePointId, payload: req });
        logger_1.logger.info(`Get config from ${chargePointId}: keys ${req.key ? req.key.join(', ') : 'all'}`);
        return { configurationKey: responseKey };
    }
    catch (err) {
        logger_1.logger.error(`Error in GetConfiguration: ${err}`);
        return { configurationKey: [] };
    }
}
