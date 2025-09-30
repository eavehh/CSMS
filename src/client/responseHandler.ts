import WebSocket from "ws";
import * as msgpack from '@msgpack/msgpack';
import { BootNotificationResponse } from "../../types/1.6/BootNotificationResponse";
import { logger } from "../logger";
import { manager } from "./index";  // Ок, если index экспортирует
import { sendHeartbeat } from './messageSender'
import { HeartbeatResponse } from '../../types/1.6/HeartbeatResponse'

let heartbeatInterval: NodeJS.Timeout;

export function handleResponse(data: Buffer, isBinary: boolean, ws: WebSocket) {
    let message: any;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        } catch (err) {
            logger.error(`Failed to decode MessagePack response: ${(err as any).message}`);
            return;
        }
    } else {
        try {
            message = JSON.parse(data.toString());
        } catch (err) {
            logger.error(`Failed to parse JSON response: ${(err as any).message}`);
            return;
        }
    }

    const [messageType, uniqueId, response] = message;
    logger.info(`Response received: type ${messageType}, uniqueId ${uniqueId}, response ${JSON.stringify(response)}`);

    if (messageType === 3) {  // CallResult от сервера
        if (response.format) {
            manager.setFormat(response.format);
        }

        if (response.status !== undefined) {
            const bootResp = response as BootNotificationResponse;
            if (bootResp.status === 'Accepted') {
                logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
                // Запусти Heartbeat loop
                heartbeatInterval = setInterval(() => sendHeartbeat(ws, {}, manager), bootResp.interval * 1000);
            } else {
                logger.error(`Boot rejected: ${bootResp.status}`);
            }
        }
        // Для HeartbeatResponse (проверяем по currentTime)
        else if (response.currentTime !== undefined) {
            const heartbeatResp = response as HeartbeatResponse;
            logger.info(`Heartbeat response: currentTime ${heartbeatResp.currentTime}`);
        }
    } else if (messageType === 4) {  // CallError
        logger.error(`Error from server: ${response.errorCode || 'Unknown'}`);
        if (heartbeatInterval) clearInterval(heartbeatInterval);  // Останови loop на ошибке
    }
}
