"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
// import { validateMessage } from './utils/ajvValidator';  // Если есть; иначе закомментируй
const bootNotification_1 = require("../handlers/bootNotification");
const authorize_1 = require("../handlers/authorize");
const heartbeat_1 = require("../handlers/heartbeat");
const statusNotification_1 = require("../handlers/statusNotification");
async function handleMessage(data, isBinary, ws, chargePointId) {
    if (isBinary) {
        // добавить парсинг msgpack
        console.log("Binary ignored");
        return;
    }
    try {
        const message = JSON.parse(data.toString());
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
        // Валидация !!!
        if (typeof messageType !== 'number' || messageType !== 2) {
            console.log(`Ignored non-Call message from ${chargePointId}: type ${messageType}`);
            return;
        }
        let response;
        switch (action) {
            case 'BootNotification':
                response = await (0, bootNotification_1.handleBootNotification)(payload, chargePointId, ws);
                break;
            case 'Authorize':
                response = await (0, authorize_1.handleAuthorize)(payload, chargePointId, ws);
                break;
            case 'Heartbeat':
                response = await (0, heartbeat_1.handleHeartbeat)(payload, chargePointId, ws);
                break;
            case 'StatusNotification':
                response = await (0, statusNotification_1.handleStatusNotification)(payload, chargePointId, ws);
                break;
            default:
                response = { error: 'UnknownAction' }; // OCPP CallError
        }
        const fullResponse = [3, uniqueId, response];
        ws.send(JSON.stringify(fullResponse));
    }
    catch (err) {
        console.error(`Router parse error from ${chargePointId}: ${err.message}. Raw: ${data.toString()}`);
        // Безопасный CallError
        ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: err.message }]));
    }
}
