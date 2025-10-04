"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCancelReservation = handleCancelReservation;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
async function handleCancelReservation(req, chargePointId, ws) {
    try {
        await mongoose_1.Reservation.findOneAndUpdate({ id: req.reservationId }, { status: 'Cancelled' }, { upsert: false });
        await mongoose_2.Log.create({ action: 'CancelReservation', chargePointId, payload: req });
        logger_1.logger.info(`Cancel reservation ${req.reservationId} from ${chargePointId}}`);
        return { status: 'Accepted' };
    }
    catch (err) {
        logger_1.logger.error(`Error in CancelReservation: ${err}`);
        return { status: 'Rejected' };
    }
}
