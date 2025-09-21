import WebSocket from 'ws';
// import { validateMessage } from './utils/ajvValidator';  // Если есть; иначе закомментируй

import { handleBootNotification } from '../handlers/bootNotification';
// import { handleAuthorize } from '../handlers/authorize';
// import { handleHeartbeat } from '../handlers/heartbeat';
// import { handleStatusNotification } from '../handlers/statusNotification';

export async function handleMessage(data: Buffer, isBinary: boolean, ws: WebSocket, chargePointId: string) {
  if (isBinary) {
    // добавить парсинг msgpack
    return;
  }

  try {
    const message = JSON.parse(data.toString());  
    const [messageType, uniqueId, action, payload] = message;  

    if (messageType !== 2) {  // Только Call (запросы от клиента)
      return;
    }

    // Валидация !!!

    let response: any;

    switch (action) {
      case 'BootNotification':
        response = await handleBootNotification(payload, chargePointId, ws);
        break;
    /*  case 'Authorize':
        response = await handleAuthorize(payload, chargePointId, ws);
        break;
      case 'Heartbeat':
        response = await handleHeartbeat(payload, chargePointId, ws);
        break;
      case 'StatusNotification':
        response = await handleStatusNotification(payload, chargePointId, ws);
        break;
      default:
        response = { error: 'UnknownAction' };  // OCPP CallError
    */
    }

    const fullResponse = [3, uniqueId, response];
    ws.send(JSON.stringify(fullResponse));
  } catch (err) {
    console.error(`Router error: ${err}`);
    // Отправить CallError
  }
}