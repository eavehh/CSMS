import { FirmwareStatusNotificationRequest } from '../types/1.6/FirmwareStatusNotification';
import { FirmwareStatusNotificationResponse } from '../types/1.6/FirmwareStatusNotificationResponse';
import { Firmware } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleFirmwareStatusNotification(req: FirmwareStatusNotificationRequest, chargePointId: string, ws: WebSocket): Promise<FirmwareStatusNotificationResponse> {
  try {
    await Firmware.findOneAndUpdate(
      { chargePointId },
      { status: req.status, firmwareVersion: Date.now() },
      { upsert: true }
    );
    await Log.create({ action: 'FirmwareStatusNotification', chargePointId, payload: req });
    logger.info(`Firmware status from ${chargePointId}: ${req.status}`);
    return {};
  } catch (err) {
    logger.error(`Error in FirmwareStatus: ${err}`);
    return {};
  }
}