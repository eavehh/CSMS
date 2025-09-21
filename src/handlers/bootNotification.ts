import { BootNotificationRequest } from '../../types/ocpp/1.6/BootNotification';  
import { BootNotificationResponse } from '../../types/ocpp/1.6/BootNotificationResponse';  
import { logger } from '../server/logger';

export async function handleBootNotification(req: BootNotificationRequest, chargePointId: string, ws: WebSocket): Promise<BootNotificationResponse> {
  logger.info(`Boot from ${chargePointId}: ${req.chargePointVendor} ${req.chargePointModel}`);

  // DB 

  return {
    currentTime: new Date().toISOString(),
    interval: 60,  // Heartbeat каждую минуту
    status: 'Accepted'
  };
}