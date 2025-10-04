import { StatusNotificationRequest } from "../types/1.6/StatusNotification"
import { StatusNotificationResponse } from "../types/1.6/StatusNotificationResponse"
import WebSocket from "ws"
import { logger } from "../../logger"

export async function handleStatusNotification(
    payload: any,
    chargePointId: string,
    ws: WebSocket
) {
    const { connectorId, status, errorCode, timestamp } = payload;

    logger.info(`[StatusNotification] ${chargePointId} connector ${connectorId} - ${status}`);

    // без внешнего триггера

    return {}; // Корректный пустой ответ
}