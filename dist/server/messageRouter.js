"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const msgpack = __importStar(require("@msgpack/msgpack"));
const logger_1 = require("../server/logger");
// import { validateMessage } from './utils/ajvValidator';  // Если есть; иначе закомментируй
const index_1 = require("../server/index");
const bootNotification_1 = require("../handlers/bootNotification");
const authorize_1 = require("../handlers/authorize");
const heartbeat_1 = require("../handlers/heartbeat");
const statusNotification_1 = require("../handlers/statusNotification");
const diagnosticsStatusNotification_1 = require("../handlers/diagnosticsStatusNotification");
const changeConfiguration_1 = require("../handlers/changeConfiguration");
const sendLocalList_1 = require("../handlers/sendLocalList");
async function handleMessage(data, isBinary, ws, chargePointId) {
    let message;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        }
        catch (err) {
            logger_1.logger.error(`Failed to decode MessagePack message from ${chargePointId}: ${err.message}`);
            ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid MessagePack' }]));
            return;
        }
    }
    else {
        try {
            message = JSON.parse(data.toString());
        }
        catch (err) {
            logger_1.logger.error(`Failed to parse JSON message from ${chargePointId}: ${err.message}`);
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
            case 'DiagnosticsStatusNotification':
                response = await (0, diagnosticsStatusNotification_1.handleDiagnosticsStatusNotification)(payload, chargePointId, ws);
                break;
            case 'ChangeConfiguration':
                response = await (0, changeConfiguration_1.handleChangeConfiguration)(payload, chargePointId, ws);
                break;
            case 'SendLocalList':
                response = await (0, sendLocalList_1.handleSendLocalList)(payload, chargePointId, ws, index_1.connectionManager);
                // case 'FirmwareStatusNotification':
                //   response = await handleFirmwareStatusNotification(payload, chargePointId, ws);
                //   break;
                // case 'MeterValues':
                //   response = await handleMeterValues(payload, chargePointId, ws);
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
