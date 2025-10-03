import WebSocket from "ws";
import * as msgpack from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger";
import { validateMessage } from "../utils/ajvValidator";
import { ClientManager } from './connectionManager'
import { BootNotificationRequest } from "../server/types/1.6/BootNotification";
import { HeartbeatRequest } from "../server/types/1.6/Heartbeat";
import { AuthorizeRequest } from '../server/types/1.6/Authorize';
import { GetConfigurationRequest } from '../server/types/1.6/GetConfiguration';
import { StartTransactionRequest } from '../server/types/1.6/StartTransaction';
import { StopTransactionRequest } from '../server/types/1.6/StopTransaction';
import { StatusNotificationRequest } from "../server/types/1.6/StatusNotification"
import { MeterValuesRequest } from '../server/types/1.6/MeterValues';
import { RemoteStartTransactionRequest } from '../server/types/1.6/RemoteStartTransaction'
import { RemoteStopTransactionRequest } from '../server/types/1.6/RemoteStopTransaction'
import { ChangeConfigurationRequest } from '../server/types/1.6/ChangeConfiguration'



export function sendBootNotification(ws: WebSocket, payload: BootNotificationRequest, manager: ClientManager) {
    // if (!validateMessage(payload, 'BootNotificationRequest')) return;

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
    if (!manager.shouldSendHeartbeat()) {
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


export function sendAuthorize(ws: WebSocket, payload: AuthorizeRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'AuthorizeRequest')) return;

    const message = [2, uuidv4(), 'Authorize', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent Authorize for idTag: ${payload.idTag}`);
}

export function sendStartTransaction(ws: WebSocket, payload: StartTransactionRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'StartTransactionRequest')) return;

    const message = [2, uuidv4(), 'StartTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent StartTransaction for connector ${payload.connectorId}, idTag: ${payload.idTag}`);
}

export function sendStopTransaction(ws: WebSocket, payload: StopTransactionRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'StopTransactionRequest')) return;

    const message = [2, uuidv4(), 'StopTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.lastStopTransactionId = uuidv4();

    manager.updateLastSentTime();
    logger.info(`Sent StopTransaction for transaction ${payload.transactionId}`);
}

export function sendStatusNotification(ws: WebSocket, payload: StatusNotificationRequest, manager: ClientManager) {
    // if (!validateMessage(payload, 'StatusNotificationRequest')) return;

    const message = [2, uuidv4(), 'StatusNotification', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.lastStatusNotificationId = uuidv4();
    manager.updateLastSentTime();
    logger.info(`Sent StatusNotification for connector ${payload.connectorId}, status: ${payload.status}`);
}

export function sendMeterValues(ws: WebSocket, payload: MeterValuesRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'MeterValuesRequest')) return;

    const message = [2, uuidv4(), 'MeterValues', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.lastMeterValuesId = uuidv4();

    manager.updateLastSentTime();
    logger.info(`Sent MeterValues for connector ${payload.connectorId}`);
}

export function sendRemoteStartTransaction(ws: WebSocket, payload: RemoteStartTransactionRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'RemoteStartTransactionRequest')) return;

    const message = [2, uuidv4(), 'RemoteStartTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent RemoteStartTransaction for idTag: ${payload.idTag}`);
}

export function sendRemoteStopTransaction(ws: WebSocket, payload: RemoteStopTransactionRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'RemoteStopTransactionRequest')) return;

    const message = [2, uuidv4(), 'RemoteStopTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent RemoteStopTransaction for transaction ${payload.transactionId}`);
}

export function sendChangeConfiguration(ws: WebSocket, payload: ChangeConfigurationRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'ChangeConfigurationRequest')) return;

    const message = [2, uuidv4(), 'ChangeConfiguration', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent ChangeConfiguration for key: ${payload.key}, value: ${payload.value}`);
}

export function sendGetConfiguration(ws: WebSocket, payload: GetConfigurationRequest, manager: ClientManager) {
    if (!validateMessage(payload, 'GetConfigurationRequest')) return;

    const message = [2, uuidv4(), 'GetConfiguration', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    } else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger.info(`Sent GetConfiguration for keys: ${payload.key?.join(', ') || 'all'}`);
}


