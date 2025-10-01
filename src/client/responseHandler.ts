import WebSocket from "ws";
import * as msgpack from '@msgpack/msgpack';
import { logger } from "../logger";
import { manager } from "./index";
import { sendHeartbeat, sendStatusNotification, sendStartTransaction } from './messageSender';
import { ClientManager } from './connectionManager'
import { BootNotificationResponse } from "../server/types/1.6/BootNotificationResponse";
import { HeartbeatResponse } from "../server/types/1.6/HeartbeatResponse";
import { AuthorizeResponse } from '../server/types/1.6/AuthorizeResponse';
import { GetConfigurationResponse } from '../server/types/1.6/GetConfigurationResponse';
import { StartTransactionResponse } from '../server/types/1.6/StartTransactionResponse';
import { StopTransactionResponse } from '../server/types/1.6/StopTransactionResponse';
import { StatusNotificationResponse } from "../server/types/1.6/StatusNotificationResponse"
import { MeterValuesResponse } from '../server/types/1.6/MeterValuesResponse';
import { RemoteStartTransactionResponse } from '../server/types/1.6/RemoteStartTransactionResponse'
import { RemoteStopTransactionResponse } from '../server/types/1.6/RemoteStopTransactionResponse'
import { ChangeConfigurationResponse } from '../server/types/1.6/ChangeConfigurationResponse'
import { ChargePointStatus } from '../utils/baseTypes';


let heartbeatInterval: NodeJS.Timeout;
let statusTimeout: NodeJS.Timeout;  // Для Finishing → Available

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

    // BootResponse (status + currentTime)
    if (response.status !== undefined && response.currentTime !== undefined) {
      const bootResp = response as BootNotificationResponse;
      if (bootResp.status === 'Accepted') {
        logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
        manager.updateInterval(bootResp.interval);

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => sendHeartbeat(ws, {}, manager), bootResp.interval * 1000);

        // Начальное StatusNotification (Available)
        sendStatusNotification(ws, {
          connectorId: 1,
          status: 'Available' as ChargePointStatus,
          errorCode: 'NoError'
        }, manager);

      } else {
        logger.error(`Boot rejected: ${bootResp.status}`);
      }
    }

    // HeartbeatResponse (только currentTime)
    else if (response.currentTime !== undefined && response.status === undefined) {
      const heartbeatResp = response as HeartbeatResponse;
      logger.info(`Heartbeat response: currentTime ${heartbeatResp.currentTime}`);
    }

    // AuthorizeResponse (idTagInfo)
    else if (response.idTagInfo !== undefined && response.status === undefined) {
      const authResp = response as AuthorizeResponse;
      if (authResp.idTagInfo.status === 'Accepted') {
        logger.info(`Authorization successful for idTag`);
        // Начинай tx
        sendStartTransaction(ws, { connectorId: 1, idTag: 'USER_123', meterStart: 0, timestamp: new Date().toISOString() }, manager);
      } else {
        logger.error(`Authorization failed: ${authResp.idTagInfo.status}`);
      }
    }

    // StartTransactionResponse (transactionId + idTagInfo)
    else if (response.transactionId !== undefined && response.idTagInfo !== undefined) {
      const startResp = response as StartTransactionResponse;
      logger.info(`Transaction started: ID ${startResp.transactionId}`);
      if (startResp.idTagInfo.status === 'Accepted') {
        manager.getState(1).startTransaction(startResp.transactionId);  // Обнови state

        // StatusNotification Charging
        sendStatusNotification(ws, {
          connectorId: 1,
          status: 'Charging' as ChargePointStatus,
          errorCode: 'NoError'
        }, manager);
      }
    }

    // StopTransactionResponse (idTagInfo или {})
    else if (response.idTagInfo !== undefined || Object.keys(response).length === 0) {
      const stopResp = response as StopTransactionResponse;
      logger.info(`Transaction stopped successfully`);
      manager.getState(1).stopTransaction();  // Обнови state

      // StatusNotification Finishing
      sendStatusNotification(ws, {
        connectorId: 1,
        status: 'Finishing' as ChargePointStatus,
        errorCode: 'NoError'
      }, manager);
    }

    // MeterValuesResponse / StatusNotificationResponse (пустой {})
    else if (Object.keys(response).length === 0) {
      logger.info(`MeterValues/StatusNotification confirmed`);
    }

    // RemoteStartTransactionResponse (status)
    else if (response.status !== undefined && response.transactionId === undefined) {
      const remoteStartResp = response as RemoteStartTransactionResponse;
      if (remoteStartResp.status === 'Accepted') {
        logger.info(`Remote start accepted`);
        // Логика remote start
      } else {
        logger.error(`Remote start rejected: ${remoteStartResp.status}`);
      }
    }

    // RemoteStopTransactionResponse (status)
    else if (response.status !== undefined && response.idTagInfo === undefined) {
      const remoteStopResp = response as RemoteStopTransactionResponse;
      if (remoteStopResp.status === 'Accepted') {
        logger.info(`Remote stop accepted`);
        // Логика remote stop
      } else {
        logger.error(`Remote stop rejected: ${remoteStopResp.status}`);
      }
    }

    // ChangeConfigurationResponse (status)
    else if (response.status !== undefined && response.configurationKey === undefined) {
      const changeConfigResp = response as ChangeConfigurationResponse;
      logger.info(`Configuration change status: ${changeConfigResp.status}`);
    }

    // GetConfigurationResponse (configurationKey)
    else if (response.configurationKey !== undefined) {
      const getConfigResp = response as GetConfigurationResponse;
      logger.info(`Retrieved ${getConfigResp.configurationKey.length} config keys`);
      getConfigResp.configurationKey.forEach(config => {
        logger.info(`Config: ${config.key} = ${config.value} (readonly: ${config.readonly})`);
      });
      if (getConfigResp.unknownKey) {
        logger.error(`Unknown keys: ${getConfigResp.unknownKey.join(', ')}`);
      }
    }
  } else if (messageType === 4) {  // CallError
    logger.error(`Error from server: ${response.errorCode || 'Unknown'} - ${response.description || ''}`);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  }

  // Входящие от сервера (type 2, Central initiated)
  else if (messageType === 2) {
    const [_, uniqueId, action, payload] = message;
    switch (action) {
      case 'RemoteStartTransaction':
        handleRemoteStartTransaction(ws, uniqueId, payload, manager);
        break;
      case 'RemoteStopTransaction':
        handleRemoteStopTransaction(ws, uniqueId, payload, manager);
        break;
      case 'ChangeConfiguration':
        handleChangeConfiguration(ws, uniqueId, payload, manager);
        break;
      case 'GetConfiguration':
        handleGetConfiguration(ws, uniqueId, payload, manager);
        break;
      case 'Reset':
        handleReset(ws, uniqueId, payload, manager);
        break;
      case 'UnlockConnector':
        handleUnlockConnector(ws, uniqueId, payload, manager);
        break;
      default:
        logger.error(`Unknown action from server: ${action}`);
        ws.send(JSON.stringify([4, uniqueId, { errorCode: 'NotImplemented', description: `Action ${action} not supported` }]));
    }
  }
}

// Обработчики type 2 (входящие от сервера)
function handleRemoteStartTransaction(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received RemoteStartTransaction for idTag: ${payload.idTag}`);
  const connector = manager.getAvailableConnector();
  if (connector) {
    // Accepted, start tx
    ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
    sendStartTransaction(ws, { connectorId: connector.getConnectorId(), idTag: payload.idTag, meterStart: 0, timestamp: new Date().toISOString() }, manager);
  } else {
    ws.send(JSON.stringify([3, uniqueId, { status: 'Rejected' }]));
  }
}

function handleRemoteStopTransaction(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received RemoteStopTransaction for tx: ${payload.transactionId}`);
  const state = manager.getState(1);
  if (state.getCurrentTransaction() === payload.transactionId) {
    ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
    state.stopTransaction();
  } else {
    ws.send(JSON.stringify([3, uniqueId, { status: 'Rejected' }]));
  }
}

function handleChangeConfiguration(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received ChangeConfiguration for key: ${payload.key}`);
  // Сохрани в state или config
  ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
}

function handleGetConfiguration(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received GetConfiguration for keys: ${payload.key?.join(', ')}`);
  const config = { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '60' }] };
  ws.send(JSON.stringify([3, uniqueId, config]));
}

function handleReset(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received Reset: ${payload.type}`);
  // Reset logic
  ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
}

function handleUnlockConnector(ws: WebSocket, uniqueId: string, payload: any, manager: ClientManager) {
  logger.info(`Received UnlockConnector for connector: ${payload.connectorId}`);
  ws.send(JSON.stringify([3, uniqueId, 'Unlocked']));
}