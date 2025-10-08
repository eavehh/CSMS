import WebSocket from 'ws';
import * as msgpack from '@msgpack/msgpack'
import { logger } from '../logger';
import { connectionManager } from './index'
import { validateMessage } from '../utils/ajvValidator'

// Sec 4: Charge Point initiated
import { handleAuthorize } from './handlers/authorize';
import { handleBootNotification } from './handlers/bootNotification';
import { handleDataTransfer } from './handlers/dataTransfer';
import { handleDiagnosticsStatusNotification } from './handlers/diagnosticsStatusNotification';
import { handleFirmwareStatusNotification } from './handlers/firmwareStatusNotification';
import { handleHeartbeat } from './handlers/heartbeat';
import { handleMeterValues } from './handlers/meterValues';
import { handleStartTransaction } from './handlers/startTransaction';
import { handleStatusNotification } from './handlers/statusNotification';
import { handleStopTransaction } from './handlers/stopTransaction';

// Sec 5: Central initiated
import { handleCancelReservation } from './handlers/cancelReservation';
import { handleChangeAvailability } from './handlers/changeAvailability';
import { handleChangeConfiguration } from './handlers/changeConfiguration';
import { handleClearCache } from './handlers/clearCache';
import { handleClearChargingProfile } from './handlers/clearChargingProfile';
import { handleGetCompositeSchedule } from './handlers/getCompositeSchedule';
import { handleGetDiagnostics } from './handlers/getDiagnostics';
import { handleGetLocalListVersion } from './handlers/getLocalListVersion';
import { handleRemoteStartTransaction } from './handlers/remoteStartTransaction';
import { handleRemoteStopTransaction } from './handlers/remoteStopTransaction';
import { handleReserveNow } from './handlers/reserveNow';
import { handleReset } from './handlers/reset';
import { handleSendLocalList } from './handlers/sendLocalList';
import { handleSetChargingProfile } from './handlers/setChargingProfile';
import { handleTriggerMessage } from './handlers/triggerMessage';
import { handleUnlockConnector } from './handlers/unlockConnector';
import { handleUpdateFirmware } from './handlers/updateFirmware';
import { handleGetConfiguration } from './handlers/getConfiguration';



export async function handleMessage(data: Buffer, isBinary: boolean, ws: WebSocket, chargePointId: string) {
  let message;

  if (isBinary) {
    try {
      message = msgpack.decode(data);
    } catch (err) {
      logger.error(`[MessageRouter] Failed to decode MessagePack message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid MessagePack' }]));
      return;
    }
  } else {
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      logger.error(`[MessageRouter] Failed to parse JSON message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid JSON' }]));
      return;
    }
  }

  try {
    const [messageType, uniqueId, actionOrPayload, payloadOrNothing] = message;

    const format = connectionManager.getFormat(chargePointId);
    connectionManager.updateLastActivity(chargePointId);  // Обновляем активность

    // Валидация (только для type 2 — запросов от клиента)
    if (messageType === 2) {
      logger.info(`[MessageRouter] from ${chargePointId} Received request: ${actionOrPayload}`);
      const validation = validateMessage(actionOrPayload, `${actionOrPayload}`);
      if (!validation) {
        logger.error(`[MessageRouter] Validation failed for ${actionOrPayload} from ${chargePointId}`);

        const errorResponse = {
          errorCode: 'FormationViolation',
          description: 'Invalid payload',
          errorDetails: 'Payload does not match OCPP schema'
        };

        const fullError = [4, uniqueId, errorResponse];

        if (format === 'binary') {
          ws.send(msgpack.encode(fullError));
        } else {
          ws.send(JSON.stringify(fullError));
        }
        return;
      }

      // Если в payload флаг смены формата (опционально)
      if (actionOrPayload.format) {
        connectionManager.setFormat(chargePointId, actionOrPayload.format);
      }

      // Обработка запросов от клиента (type 2)
      let response: any;

      switch (actionOrPayload) {
        case 'BootNotification':
          response = await handleBootNotification(payloadOrNothing, chargePointId, (ws as any));
          break;
        case 'Authorize':
          response = await handleAuthorize(payloadOrNothing, chargePointId, ws);
          break;
        case 'Heartbeat':
          response = await handleHeartbeat(payloadOrNothing, chargePointId, ws);
          break;
        case 'StatusNotification':
          response = await handleStatusNotification(payloadOrNothing, chargePointId, ws);
          break;
        case 'DataTransfer':
          response = await handleDataTransfer(payloadOrNothing, chargePointId, ws);
          break;
        case 'DiagnosticsStatusNotification':
          response = await handleDiagnosticsStatusNotification(payloadOrNothing, chargePointId, ws);
          break;
        case 'FirmwareStatusNotification':
          response = await handleFirmwareStatusNotification(payloadOrNothing, chargePointId, ws);
          break;
        case 'MeterValues':
          response = await handleMeterValues(payloadOrNothing, chargePointId, ws);
          break;
        case 'StartTransaction':
          response = await handleStartTransaction(payloadOrNothing, chargePointId, ws);
          break;
        case 'StopTransaction':
          response = await handleStopTransaction(payloadOrNothing, chargePointId, ws);
          break;
        default:
          response = { errorCode: 'NotImplemented', description: `Action ${actionOrPayload} not supported` };
          logger.warn(`Unhandled action from ${chargePointId}: ${actionOrPayload}`);
      }

      // Отправка ответа (type 3)
      const fullResponse = format === 'binary' ? msgpack.encode([3, uniqueId, response]) : JSON.stringify([3, uniqueId, response]);
      ws.send(fullResponse);
    } else if (messageType === 3) {  // Ответы от клиента на наши команды (type 2)
      logger.info(`[MeesageRouter] from ${chargePointId} Received response for ID: ${uniqueId}`);

      // Корреляция по uniqueId (используйте pendingRequests из ConnectionManager)
      const requestAction = connectionManager.getAndClearPendingRequest(uniqueId);
      if (!requestAction) {
        logger.warn(`[MeesageRouter] Received response for unknown request ID: ${uniqueId} from ${chargePointId}`);
        return;
      }

      const responsePayload = actionOrPayload;  // Payload ответа (e.g., {status: 'Accepted'})

      // Обработка ответов (switch на requestAction)
      switch (requestAction) {
        case 'ReserveNow':
          await handleReserveNow(responsePayload, chargePointId, ws);
          break;
        case 'CancelReservation':
          await handleCancelReservation(responsePayload, chargePointId, ws);
          break;
        case 'ChangeAvailability':
          await handleChangeAvailability(responsePayload, chargePointId, ws);
          break;
        case 'ChangeConfiguration':
          await handleChangeConfiguration(responsePayload, chargePointId, ws);
          break;
        case 'ClearCache':
          await handleClearCache(responsePayload, chargePointId, ws);
          break;
        case 'ClearChargingProfile':
          await handleClearChargingProfile(responsePayload, chargePointId, ws);
          break;
        case 'GetCompositeSchedule':
          await handleGetCompositeSchedule(responsePayload, chargePointId, ws);
          break;
        case 'GetConfiguration':
          await handleGetConfiguration(responsePayload, chargePointId, ws);
          break;
        case 'GetDiagnostics':
          await handleGetDiagnostics(responsePayload, chargePointId, ws);
          break;
        case 'GetLocalListVersion':
          await handleGetLocalListVersion(responsePayload, chargePointId, ws);
          break;
        case 'RemoteStartTransaction':
          await handleRemoteStartTransaction(responsePayload, chargePointId, ws);
          break;
        case 'RemoteStopTransaction':
          await handleRemoteStopTransaction(responsePayload, chargePointId, ws);
          break;
        case 'Reset':
          await handleReset(responsePayload, chargePointId, ws);
          break;
        case 'SendLocalList':
          await handleSendLocalList(responsePayload, chargePointId, ws);
          break;
        case 'SetChargingProfile':
          await handleSetChargingProfile(responsePayload, chargePointId, ws);
          break;
        case 'TriggerMessage':
          await handleTriggerMessage(responsePayload, chargePointId, ws);
          break;
        case 'UnlockConnector':
          await handleUnlockConnector(responsePayload, chargePointId, ws);
          break;
        case 'UpdateFirmware':
          await handleUpdateFirmware(responsePayload, chargePointId, ws);
          break;
        default:
          logger.warn(`[MessageRouter] Unhandled response for action ${requestAction} from ${chargePointId}`);
      }
    } else if (messageType === 4) {  // CallError от клиента
      logger.error(`[handleMessage] CallError from ${chargePointId}: ${JSON.stringify(actionOrPayload)}`);
      // Очистите pending для этого uniqueId
      //                                      connectionManager.getAndClearPending(uniqueId);
    } else {
      logger.error(`[handleMessage] Unknown message type ${messageType} from ${chargePointId}`);
    }
  } catch (err) {
    logger.error(`[Response send] Router parse error from ${chargePointId}: ${(err as any).message}. MESSAGE: ${data.toString()}`);
    // Безопасный CallError
    ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: (err as any).message }]));
  }
}