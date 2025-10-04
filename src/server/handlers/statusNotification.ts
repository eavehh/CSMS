import { StatusNotificationRequest } from "../types/1.6/StatusNotification"
import { StatusNotificationResponse } from "../types/1.6/StatusNotificationResponse"
import WebSocket from "ws"
import { logger } from "../../logger"
import { connectionManager } from '../../server/index';

export async function handleStatusNotification(
    payload: any,
    chargePointId: string,
    ws: WebSocket
) {
    const { connectorId, status, errorCode, timestamp } = payload;
    connectionManager.updateConnectorState(chargePointId, payload.connectorId, payload.status, undefined, payload.errorCode);
    logger.info(`[StatusNotification] ${chargePointId} connector ${connectorId} - ${status}`);

    // без внешнего триггера

    return {}; // Корректный пустой ответ
}