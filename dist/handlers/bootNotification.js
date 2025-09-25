"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBootNotification = handleBootNotification;
const mongoose_1 = require("../db/mongoose");
const logger_1 = require("../server/logger");
async function handleBootNotification(req, chargePointId, ws) {
    try {
        // Upsert: Создай или обнови ChargePoint
        await mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, // в которой ...  
        {
            id: chargePointId,
            vendor: req.chargePointVendor,
            model: req.chargePointModel,
            serial: req.chargeBoxSerialNumber,
            firmware: req.firmwareVersion
        }, // Что обновить
        { upsert: true, new: true } // Если нет — создай
        );
        logger_1.logger.info(`Boot from ${chargePointId}: saved to MongoDB`);
    }
    catch (err) {
        logger_1.logger.error(`DB save error: ${err}`);
    }
    return { currentTime: new Date().toISOString(), interval: 60, status: 'Accepted' };
}
