import { StatusNotificationRequest } from "../../types/ocpp/1.6/StatusNotification"
import { StatusNotificationResponse } from "../../types/ocpp/1.6/StatusNotificationResponse"
import WevSocket from "ws"
import { logger } from "../server/logger"

export async function handleStatusNotification(req: StatusNotificationRequest, chargePointId: string, ws: WevSocket): Promise<StatusNotificationResponse> {
    logger.info(`Status from ${chargePointId}; connector ${req.connectorId} ${req.status}`)

    return {

    }
}