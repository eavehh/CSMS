"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleClearCache = handleClearCache;
const mongoose_1 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleClearCache(req, chargePointId, ws) {
    try {
        // Логика: очисти локальный кэш на Charge Point (сервер не хранит)
        await mongoose_1.Log.create({ action: 'ClearCache', chargePointId, payload: req });
        logger_1.logger.info(`Clear cache for ${chargePointId}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in ClearCache: ${err}`);
        return { status: 'Rejected' };
    }
}
