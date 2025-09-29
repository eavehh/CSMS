import { DiagnosticsStatusNotificationRequest } from '../../types/1.6/DiagnosticsStatusNotification';
import { DiagnosticsStatusNotificationResponse } from '../../types/1.6/DiagnosticsStatusNotificationResponse';
import { logger } from '../logger';
import WebSocket from 'ws';

export async function handleDiagnosticsStatusNotification(req: DiagnosticsStatusNotificationRequest, chargePointId: string, ws: WebSocket): Promise<DiagnosticsStatusNotificationResponse> {
  logger.info(`Diagnostics from ${chargePointId}: ${req.status}`);
  return {};  // Пустой ответ
}