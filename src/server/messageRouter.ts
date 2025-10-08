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
      logger.error(`[decode MSG] Failed to decode MessagePack message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid MessagePack' }]));
      return;
    }
  } else {
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      logger.error(`[parse JSON] Failed to parse JSON message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid JSON' }]));
      return;
    }
  }

  try {


    const [messageType, uniqueId, action, payload] = message;

    logger.info(`[handleMessage] from ${chargePointId} Received: ${action}`);
    const format = connectionManager.getFormat(chargePointId);

    const validation = validateMessage(payload, `${action}Request`);
    if (!validation.valid) {
      logger.error(`Validation failed for ${action} from ${chargePointId}: ${(validation.errors as any).map((e: any) => e.message).join('; ')}`);
      const errorResponse = {
        errorCode: 'FormationViolation',
        description: 'Invalid payload',
        errorDetails: validation.errors?.[0]?.message || ''
      };
      const fullError = [4, uniqueId, errorResponse];
      if (format === 'binary') {
        ws.send(msgpack.encode(fullError));
      } else {
        ws.send(JSON.stringify(fullError));
      }
      return;
    }



    // Если в payload флаг смены (опционально, e.g., req.format = 'binary')
    if (payload.format) {
      connectionManager.setFormat(chargePointId, payload.format);
    }

    connectionManager.updateLastActivity(chargePointId); // для ocpp 4.6 heartbeat не использовался избыточно
    // Валидация !!!

    if (messageType === 3) { //CallResult

    }


    let response: any;

    switch (action) {
      case 'BootNotification':
        response = await handleBootNotification(payload, chargePointId, (ws as any));
        break;
      case 'Authorize':
        response = await handleAuthorize(payload, chargePointId, ws);
        break;
      case 'Heartbeat':
        response = await handleHeartbeat(payload, chargePointId, ws);
        break;
      case 'StatusNotification':
        response = await handleStatusNotification(payload, chargePointId, ws);
        break;
      case 'DataTransfer':
        response = await handleDataTransfer(payload, chargePointId, ws);
        break;
      case 'DiagnosticsStatusNotification':
        response = await handleDiagnosticsStatusNotification(payload, chargePointId, ws);
        break;
      case 'FirmwareStatusNotification':
        response = await handleFirmwareStatusNotification(payload, chargePointId, ws);
        break;
      case 'MeterValues':
        response = await handleMeterValues(payload, chargePointId, ws);
        break;
      case 'StartTransaction':
        response = await handleStartTransaction(payload, chargePointId, ws);
        break;
      case 'StopTransaction':
        response = await handleStopTransaction(payload, chargePointId, ws);
        break;
      // Sec 5 (ответы на Central)
      case 'CancelReservation':
        response = await handleCancelReservation(payload, chargePointId, ws);
        break;
      case 'ChangeAvailability':
        response = await handleChangeAvailability(payload, chargePointId, ws);
        break;
      case 'ChangeConfiguration':
        response = await handleChangeConfiguration(payload, chargePointId, ws);
        break;
      case 'ClearCache':
        response = await handleClearCache(payload, chargePointId, ws);
        break;
      case 'ClearChargingProfile':
        response = await handleClearChargingProfile(payload, chargePointId, ws);
        break;
      case 'GetCompositeSchedule':
        response = await handleGetCompositeSchedule(payload, chargePointId, ws);
        break;
      case 'GetConfiguration':
        response = await handleGetConfiguration(payload, chargePointId, ws);
        break;
      case 'GetDiagnostics':
        response = await handleGetDiagnostics(payload, chargePointId, ws);
        break;
      case 'GetLocalListVersion':
        response = await handleGetLocalListVersion(payload, chargePointId, ws);
        break;
      case 'RemoteStartTransaction':
        response = await handleRemoteStartTransaction(payload, chargePointId, ws);
        break;
      case 'RemoteStopTransaction':
        response = await handleRemoteStopTransaction(payload, chargePointId, ws);
        break;
      case 'ReserveNow':
        response = await handleReserveNow(payload, chargePointId, ws);
        break;
      case 'Reset':
        response = await handleReset(payload, chargePointId, ws);
        break;
      case 'SendLocalList':
        response = await handleSendLocalList(payload, chargePointId, ws);
        break;
      case 'SetChargingProfile':
        response = await handleSetChargingProfile(payload, chargePointId, ws);
        break;
      case 'TriggerMessage':
        response = await handleTriggerMessage(payload, chargePointId, ws);
        break;
      case 'UnlockConnector':
        response = await handleUnlockConnector(payload, chargePointId, ws);
        break;
      case 'UpdateFirmware':
        response = await handleUpdateFirmware(payload, chargePointId, ws);
        break;
      case 'StartTransaction':
        response = await handleStartTransaction(payload, chargePointId, ws);
        break;
      case 'StopTransaction':
        response = await handleStopTransaction(payload, chargePointId, ws);
        break;
      case 'SendLocalList':
        response = await handleSendLocalList(payload, chargePointId, ws);
        break;
      default:
        response = { errorCode: 'NotImplemented', description: `Action ${action} not supported` };
    }

    let fullResponse;
    if (format === 'binary') {
      fullResponse = msgpack.encode([3, uniqueId, response]);
    } else {
      fullResponse = JSON.stringify([3, uniqueId, response]);
    }
    ws.send(fullResponse);
  } catch (err) {
    logger.error(`[Response send] Router parse error from ${chargePointId}: ${(err as any).message}. RESPONSE: ${data.toString()}`);
    // Безопасный CallError
    ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: (err as any).message }]));
  }
}
