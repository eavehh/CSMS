import { ReserveNowRequest } from '../../server/types/1.6/ReserveNow';
import { ReserveNowResponse } from '../../server/types/1.6/ReserveNowResponse';
import { Reservation } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleReserveNow(req: ReserveNowRequest, chargePointId: string, ws: WebSocket): Promise<ReserveNowResponse> {
  try {
    const reservation = new Reservation({
      id: req.reservationId,
      chargePointId,
      connectorId: req.connectorId,
      idTag: req.idTag,
      expiryDate: new Date(Date.now() + 30 * 60 * 1000)  // 30 min
    });
    await reservation.save();
    await Log.create({ action: 'ReserveNow', chargePointId, payload: req });
    logger.info(`Reserve now for ${chargePointId}, connector ${req.connectorId}: idTag ${req.idTag}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in ReserveNow: ${err}`);
    return { status: 'Rejected' };
  }
}