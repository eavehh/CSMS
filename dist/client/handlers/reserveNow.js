"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReserveNow = handleReserveNow;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleReserveNow(req, chargePointId, ws) {
    try {
        const reservation = new mongoose_1.Reservation({
            id: req.reservationId,
            chargePointId,
            connectorId: req.connectorId,
            idTag: req.idTag,
            expiryDate: new Date(Date.now() + 30 * 60 * 1000) // 30 min
        });
        await reservation.save();
        await mongoose_2.Log.create({ action: 'ReserveNow', chargePointId, payload: req });
        logger_1.logger.info(`Reserve now for ${chargePointId}, connector ${req.connectorId}: idTag ${req.idTag}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in ReserveNow: ${err}`);
        return { status: 'Rejected' };
    }
}
