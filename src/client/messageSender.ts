import WebSocket from "ws";
import * as msgpack from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger";
import { validateMessage } from "../utils/ajvValidator";
import { BootNotificationRequest } from "../../types/1.6/BootNotification";
import {ClientManager} from "./connectionManager"

export function sendBootNotification(ws: WebSocket, payload: BootNotificationRequest, manager: ClientManager) {  
  if (!validateMessage(payload, 'BootNotificationRequest')) return;

  const message = [2, uuidv4(), 'BootNotification', payload];
  if (manager.getFormat() === 'binary') {
    ws.send(msgpack.encode(message));
  } else {
    ws.send(JSON.stringify(message));
  }
  logger.info('Sent BootNotification');
}