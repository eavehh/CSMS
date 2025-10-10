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
          logger.info(`[BootNotification Handled] response=${JSON.stringify(response)}`)
          break;
        case 'Authorize':
          response = await handleAuthorize(payloadOrNothing, chargePointId, ws);
          logger.info(`[Authorize Handled] response=${JSON.stringify(response)}`)
          break;
        case 'Heartbeat':
          response = await handleHeartbeat(payloadOrNothing, chargePointId, ws);
          logger.info(`[Heartbeat Handled] response=${JSON.stringify(response)}`)
          break;
        case 'StatusNotification':
          response = await handleStatusNotification(payloadOrNothing, chargePointId, ws);
          logger.info(`[StatusNotification Handled] response=${JSON.stringify(response)}`)
          break;
        case 'DataTransfer':
          response = await handleDataTransfer(payloadOrNothing, chargePointId, ws);
          logger.info(`[DataTransfer Handled] response=${JSON.stringify(response)}`)
          break;
        case 'DiagnosticsStatusNotification':
          response = await handleDiagnosticsStatusNotification(payloadOrNothing, chargePointId, ws);
          logger.info(`[DiagnosticsStatusNotification Handled] response=${JSON.stringify(response)}`)
          break;
        case 'FirmwareStatusNotification':
          response = await handleFirmwareStatusNotification(payloadOrNothing, chargePointId, ws);
          logger.info(`[FirmwareStatusNotification Handled] response=${JSON.stringify(response)}`)
          break;
        case 'MeterValues':
          response = await handleMeterValues(payloadOrNothing, chargePointId, ws);
          logger.info(`[MeterValues Handled] response=${JSON.stringify(response)}`)
          break;
        case 'StartTransaction':
          response = await handleStartTransaction(payloadOrNothing, chargePointId, ws);
          logger.info(`[StartTransaction Handled] response=${JSON.stringify(response)}`)
          break;
        case 'StopTransaction':
          response = await handleStopTransaction(payloadOrNothing, chargePointId, ws);
          logger.info(`[StopTransaction Handled] response=${JSON.stringify(response)}`)
          break;
        default:
          response = { errorCode: 'NotImplemented', description: `Action ${actionOrPayload} not supported` };
          logger.warn(`Unhandled action from ${chargePointId}: ${actionOrPayload}`);
      }

      // Отправка ответа (type 3)
      const fullResponse = format === 'binary' ? msgpack.encode([3, uniqueId, response]) : JSON.stringify([3, uniqueId, response]);
      ws.send(fullResponse);
      logger.info(`[MeesageRouter] Response Sent type 3 to ${chargePointId}: ${JSON.stringify(response)}`);
    } else if (messageType === 3) {  // Ответы от клиента на наши команды (type 2)
      logger.info(`[MeesageRouter] Response Received type 3 from ${chargePointId}: payload=${JSON.stringify(actionOrPayload)}`);
      // Корреляция по uniqueId (используйте pendingRequests из ConnectionManager)
      const requestAction = connectionManager.getAndClearPendingRequest(uniqueId);
      if (!requestAction) {
        logger.warn(`[MeesageRouter] Received response for UNKNOWN request ID: ${uniqueId} from ${chargePointId}`);
        return;
      }

      const responsePayload = actionOrPayload;  // Payload ответа (e.g., {status: 'Accepted'})

      // Обработка ответов (switch на requestAction)
      switch (requestAction) {
        case 'ReserveNow':
          await handleReserveNow(responsePayload, chargePointId, ws);
          logger.info(`[ReserveNow Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'CancelReservation':
          await handleCancelReservation(responsePayload, chargePointId, ws);
          logger.info(`[CancelReservation Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'ChangeAvailability':
          await handleChangeAvailability(responsePayload, chargePointId, ws);
          logger.info(`[ChangeAvailability Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'ChangeConfiguration':
          await handleChangeConfiguration(responsePayload, chargePointId, ws);
          logger.info(`[ChangeConfiguration Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'ClearCache':
          await handleClearCache(responsePayload, chargePointId, ws);
          logger.info(`[ClearCache Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'ClearChargingProfile':
          await handleClearChargingProfile(responsePayload, chargePointId, ws);
          logger.info(`[ClearChargingProfile Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'GetCompositeSchedule':
          await handleGetCompositeSchedule(responsePayload, chargePointId, ws);
          logger.info(`[GetCompositeSchedule Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'GetConfiguration':
          await handleGetConfiguration(responsePayload, chargePointId, ws);
          logger.info(`[GetConfiguration Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'GetDiagnostics':
          await handleGetDiagnostics(responsePayload, chargePointId, ws);
          logger.info(`[GetDiagnostics Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'GetLocalListVersion':
          await handleGetLocalListVersion(responsePayload, chargePointId, ws);
          logger.info(`[GetLocalListVersion Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'RemoteStartTransaction':
          await handleRemoteStartTransaction(responsePayload, chargePointId, ws);
          logger.info(`[RemoteStartTransaction Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'RemoteStopTransaction':
          await handleRemoteStopTransaction(responsePayload, chargePointId, ws);
          logger.info(`[RemoteStopTransaction Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'Reset':
          await handleReset(responsePayload, chargePointId, ws);
          logger.info(`[Reset Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'SendLocalList':
          await handleSendLocalList(responsePayload, chargePointId, ws);
          logger.info(`[SendLocalList Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'SetChargingProfile':
          await handleSetChargingProfile(responsePayload, chargePointId, ws);
          logger.info(`[SetChargingProfile Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'TriggerMessage':
          await handleTriggerMessage(responsePayload, chargePointId, ws);
          logger.info(`[TriggerMessage Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'UnlockConnector':
          await handleUnlockConnector(responsePayload, chargePointId, ws);
          logger.info(`[UnlockConnector Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        case 'UpdateFirmware':
          await handleUpdateFirmware(responsePayload, chargePointId, ws);
          logger.info(`[UpdateFirmware Handled] response=${JSON.stringify(responsePayload)}`)
          break;
        default:
          logger.warn(`[MessageRouter] Unhandled response for action ${requestAction} from ${chargePointId}`);
      }
    } else if (messageType === 4) {  // CallError от клиента
      logger.error(`[MessageRouter] CallError from ${chargePointId}: ${JSON.stringify(actionOrPayload)}; deleting pending`);
      connectionManager.getAndClearPendingRequest(uniqueId);

    } else {
      logger.warn(`[MessageRouter] Unknown Type ${messageType} from ${chargePointId}: ${JSON.stringify(message)}`);
    }
  } catch (err) {
    logger.error(`[MessageRouter] Router parse error from ${chargePointId}: ${(err as any).message}. MESSAGE: ${data.toString()}`);
    // Безопасный CallError
    ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: (err as any).message }]));
  }
}