import { GetCompositeScheduleRequest } from '../../../types/1.6/GetCompositeSchedule';
import { GetCompositeScheduleResponse } from '../../../types/1.6/GetCompositeScheduleResponse';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleGetCompositeSchedule(req: GetCompositeScheduleRequest, chargePointId: string, ws: WebSocket): Promise<GetCompositeScheduleResponse> {
  try {
    // Логика: верни композитное расписание (из DB или default)
    await Log.create({ action: 'GetCompositeSchedule', chargePointId, payload: req });
    logger.info(`Get composite schedule for ${chargePointId}: duration ${req.duration}`);
    return {
      status: 'Accepted',
      connectorId: req.connectorId,
    };
  } catch (err) {
    logger.error(`Error in GetCompositeSchedule: ${err}`);
    return { status: 'Rejected' };
  }
}