import { StatusNotificationRequest } from "../types/1.6/StatusNotification"
import { StatusNotificationResponse } from "../types/1.6/StatusNotificationResponse"
import WevSocket from "ws"
import { logger } from "../../logger"

export async function handleStatusNotification(req: StatusNotificationRequest, chargePointId: string, ws: WevSocket): Promise<StatusNotificationResponse> {
    logger.info(`Status from ${chargePointId}; connector ${req.connectorId} ${req.status}`)

    return {

    }
}