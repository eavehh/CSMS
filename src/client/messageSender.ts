import WebSocket from "ws";
import * as msgpack from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger";
import { validateMessage } from "../utils/ajvValidator";
import { BootNotificationRequest } from "../../types/1.6/BootNotification";
import { HeartbeatRequest } from "../../types/1.6/Heartbeat";
import { ClientManager } from './connectionManager'

export function sendBootNotification(ws: WebSocket, payload: BootNotificationRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'BootNotificationRequest')) return;

    const message = [2, uuidv4(), 'BootNotification', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message))
    } else {
        ws.send(JSON.stringify(message))
    }
    manager.updateLastSentTime()
    logger.info('Sent BootNotification')
}

export function sendHeartbeat(ws: WebSocket, payload: HeartbeatRequest, manager: ClientManager) {
    if (!manager.shouldSendHeartbeat()){
        logger.info(`heartbeat is not required (ocpp/v1.6 chapter 4.6 - skip sending)`)
    }

    const message = [2, uuidv4(), 'Heartbeat', payload]
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message))
    } else {
        ws.send(JSON.stringify(message))
    }
    manager.updateLastSentTime()
    logger.info(`heartbeat request`)
}





