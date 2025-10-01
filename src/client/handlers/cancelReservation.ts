import { CancelReservationRequest } from '../../../types/1.6/CancelReservation';
import { CancelReservationResponse } from '../../../types/1.6/CancelReservationResponse';
import { Reservation } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleCancelReservation(req: CancelReservationRequest, chargePointId: string, ws: WebSocket): Promise<CancelReservationResponse> {
  try {
    await Reservation.findOneAndUpdate(
      { id: req.reservationId },
      { status: 'Cancelled' },
      { upsert: false }
    );
    await Log.create({ action: 'CancelReservation', chargePointId, payload: req });
    logger.info(`Cancel reservation ${req.reservationId} from ${chargePointId}: ${req.status}`);
    return { status: req.status || 'Accepted' };
  } catch (err) {
    logger.error(`Error in CancelReservation: ${err}`);
    return { status: 'Rejected' };
  }
}