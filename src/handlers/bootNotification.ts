import { BootNotificationRequest } from '../../types/ocpp/1.6/BootNotification';  
import { BootNotificationResponse } from '../../types/ocpp/1.6/BootNotificationResponse';  
import {ChargePoint} from "../db/mongoose"
import { logger } from '../server/logger'

export async function handleBootNotification(req: BootNotificationRequest, chargePointId: string, ws: WebSocket): Promise<BootNotificationResponse> {
  try {
    // Upsert: Создай или обнови ChargePoint
    await ChargePoint.findOneAndUpdate( { id: chargePointId }, // в которой ...  
      { 
        id: chargePointId,
        vendor: req.chargePointVendor,
        model: req.chargePointModel,
        serial: req.chargeBoxSerialNumber,
        firmware: req.firmwareVersion
      },  // Что обновить
      { upsert: true, new: true }  // Если нет — создай
    );
    logger.info(`Boot from ${chargePointId}: saved to MongoDB`);
  } catch (err) {
    logger.error(`DB save error: ${err}`);
  }

  return { currentTime: new Date().toISOString(), interval: 60, status: 'Accepted' };
}