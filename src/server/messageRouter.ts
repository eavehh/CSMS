import WebSocket from 'ws';
import * as msgpack from '@msgpack/msgpack'
import { logger } from '../logger';
// import { validateMessage } from './utils/ajvValidator';  // Если есть; иначе закомментируй
import { connectionManager } from '../server/index';
import { handleBootNotification } from '../handlers/bootNotification';
import { handleAuthorize } from '../handlers/authorize';
import { handleHeartbeat } from '../handlers/heartbeat';
import { handleStatusNotification } from '../handlers/statusNotification';
import { handleDiagnosticsStatusNotification } from '../handlers/diagnosticsStatusNotification';
import { handleChangeConfiguration } from "../handlers/changeConfiguration"

export async function handleMessage(data: Buffer, isBinary: boolean, ws: WebSocket, chargePointId: string) {
  let message;

  if (isBinary) {
    try {
      message = msgpack.decode(data);
    } catch (err) {
      logger.error(`Failed to decode MessagePack message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid MessagePack' }]));
      return;
    }
  } else {
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      logger.error(`Failed to parse JSON message from ${chargePointId}: ${(err as any).message}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid JSON' }]));
      return;
    }
  }

  try {

    // ======================= проверка
    if (!Array.isArray(message)) {
      console.error(`Invalid message from ${chargePointId}: not an array. Got:`, message);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Message must be array' }]));
      return;
    }

    // Проверяем длину (OCPP минимум 3-4 элемента)
    if (message.length < 3) {
      console.error(`Invalid message from ${chargePointId}: too short. Length: ${message.length}`);
      ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation' }]));
      return;
    }
    // ==========================

    const [messageType, uniqueId, action, payload] = message;

    const format = connectionManager.getFormat(chargePointId);

    // Если в payload флаг смены (опционально, e.g., req.format = 'binary')
    if (payload.format) {
      connectionManager.setFormat(chargePointId, payload.format);
    }

    // Валидация !!!

    if (messageType === 3) { //CallResult

    }


    let response: any;

    switch (action) {
      case 'BootNotification':
        response = await handleBootNotification(payload, chargePointId, ws);
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
      case 'DiagnosticsStatusNotification':
        response = await handleDiagnosticsStatusNotification(payload, chargePointId, ws);
        break;
      case 'ChangeConfiguration':
        response = await handleChangeConfiguration(payload, chargePointId, ws)
        break
        // case 'FirmwareStatusNotification':
        //   response = await handleFirmwareStatusNotification(payload, chargePointId, ws);
        //   break;
        // case 'MeterValues':
        //   response = await handleMeterValues(payload, chargePointId, ws);
        break;
      default:
        response = { error: 'UnknownAction' };  // OCPP CallError
    }

    let fullResponse;
    if (format === 'binary') {
      fullResponse = msgpack.encode([3, uniqueId, response]);
    } else {
      fullResponse = JSON.stringify([3, uniqueId, response]);
    }
    ws.send(fullResponse); ws.send(JSON.stringify(fullResponse));
  } catch (err) {
    console.error(`Router parse error from ${chargePointId}: ${(err as any).message}. Raw: ${data.toString()}`);
    // Безопасный CallError
    ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: (err as any).message }]));
  }
}