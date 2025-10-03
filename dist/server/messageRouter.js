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
const logger_1 = require("../logger");
const index_1 = require("./index");
// Sec 4: Charge Point initiated
const authorize_1 = require("./handlers/authorize");
const bootNotification_1 = require("./handlers/bootNotification");
const dataTransfer_1 = require("./handlers/dataTransfer");
const getConfiguration_1 = require("../client/handlers/getConfiguration");
const diagnosticsStatusNotification_1 = require("./handlers/diagnosticsStatusNotification");
const firmwareStatusNotification_1 = require("./handlers/firmwareStatusNotification");
const heartbeat_1 = require("./handlers/heartbeat");
const meterValues_1 = require("./handlers/meterValues");
const startTransaction_1 = require("./handlers/startTransaction");
const statusNotification_1 = require("./handlers/statusNotification");
const stopTransaction_1 = require("./handlers/stopTransaction");
// Sec 5: Central initiated
const cancelReservation_1 = require("../client/handlers/cancelReservation");
const changeAvailability_1 = require("../client/handlers/changeAvailability");
const changeConfiguration_1 = require("../client/handlers/changeConfiguration");
const clearCache_1 = require("../client/handlers/clearCache");
const clearChargingProfile_1 = require("../client/handlers/clearChargingProfile");
const getCompositeSchedule_1 = require("../client/handlers/getCompositeSchedule");
const getDiagnostics_1 = require("../client/handlers/getDiagnostics");
const getLocalListVersion_1 = require("../client/handlers/getLocalListVersion");
const remoteStartTransaction_1 = require("../client/handlers/remoteStartTransaction");
const remoteStopTransaction_1 = require("../client/handlers/remoteStopTransaction");
const reserveNow_1 = require("../client/handlers/reserveNow");
const reset_1 = require("../client/handlers/reset");
const sendLocalList_1 = require("../client/handlers/sendLocalList");
const setChargingProfile_1 = require("../client/handlers/setChargingProfile");
const triggerMessage_1 = require("../client/handlers/triggerMessage");
const unlockConnector_1 = require("../client/handlers/unlockConnector");
const updateFirmware_1 = require("../client/handlers/updateFirmware");
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
        const [messageType, uniqueId, action, payload] = message;
        logger_1.logger.info(`[${chargePointId}] Received: ${action}`);
        const format = index_1.connectionManager.getFormat(chargePointId);
        // const validation = validateMessage(payload, `${action}Request`);
        // if (!validation.valid) {
        //   logger.error(`Validation failed for ${action} from ${chargePointId}: ${(validation.errors as any).map(e => e.message).join('; ')}`);
        //   const errorResponse = {
        //     errorCode: 'FormationViolation',
        //     description: 'Invalid payload',
        //     errorDetails: validation.errors?.[0]?.message || ''
        //   };
        //   const fullError = [4, uniqueId, errorResponse];
        //   if (format === 'binary') {
        //     ws.send(msgpack.encode(fullError));
        //   } else {
        //     ws.send(JSON.stringify(fullError));
        //   }
        //   return;
        // }
        // Если в payload флаг смены (опционально, e.g., req.format = 'binary')
        if (payload.format) {
            index_1.connectionManager.setFormat(chargePointId, payload.format);
        }
        index_1.connectionManager.updateLastActivity(chargePointId); // для ocpp 4.6 heartbeat не использовался избыточно
        // Валидация !!!
        if (messageType === 3) { //CallResult
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
            case 'DataTransfer':
                response = await (0, dataTransfer_1.handleDataTransfer)(payload, chargePointId, ws);
                break;
            case 'DiagnosticsStatusNotification':
                response = await (0, diagnosticsStatusNotification_1.handleDiagnosticsStatusNotification)(payload, chargePointId, ws);
                break;
            case 'FirmwareStatusNotification':
                response = await (0, firmwareStatusNotification_1.handleFirmwareStatusNotification)(payload, chargePointId, ws);
                break;
            case 'MeterValues':
                response = await (0, meterValues_1.handleMeterValues)(payload, chargePointId, ws);
                break;
            case 'StartTransaction':
                response = await (0, startTransaction_1.handleStartTransaction)(payload, chargePointId, ws);
                break;
            case 'StopTransaction':
                response = await (0, stopTransaction_1.handleStopTransaction)(payload, chargePointId, ws);
                break;
            // Sec 5 (ответы на Central)
            case 'CancelReservation':
                response = await (0, cancelReservation_1.handleCancelReservation)(payload, chargePointId, ws);
                break;
            case 'ChangeAvailability':
                response = await (0, changeAvailability_1.handleChangeAvailability)(payload, chargePointId, ws);
                break;
            case 'ChangeConfiguration':
                response = await (0, changeConfiguration_1.handleChangeConfiguration)(payload, chargePointId, ws);
                break;
            case 'ClearCache':
                response = await (0, clearCache_1.handleClearCache)(payload, chargePointId, ws);
                break;
            case 'ClearChargingProfile':
                response = await (0, clearChargingProfile_1.handleClearChargingProfile)(payload, chargePointId, ws);
                break;
            case 'GetCompositeSchedule':
                response = await (0, getCompositeSchedule_1.handleGetCompositeSchedule)(payload, chargePointId, ws);
                break;
            case 'GetConfiguration':
                response = await (0, getConfiguration_1.handleGetConfiguration)(payload, chargePointId, ws);
                break;
            case 'GetDiagnostics':
                response = await (0, getDiagnostics_1.handleGetDiagnostics)(payload, chargePointId, ws);
                break;
            case 'GetLocalListVersion':
                response = await (0, getLocalListVersion_1.handleGetLocalListVersion)(payload, chargePointId, ws);
                break;
            case 'RemoteStartTransaction':
                response = await (0, remoteStartTransaction_1.handleRemoteStartTransaction)(payload, chargePointId, ws);
                break;
            case 'RemoteStopTransaction':
                response = await (0, remoteStopTransaction_1.handleRemoteStopTransaction)(payload, chargePointId, ws);
                break;
            case 'ReserveNow':
                response = await (0, reserveNow_1.handleReserveNow)(payload, chargePointId, ws);
                break;
            case 'Reset':
                response = await (0, reset_1.handleReset)(payload, chargePointId, ws);
                break;
            case 'SendLocalList':
                response = await (0, sendLocalList_1.handleSendLocalList)(payload, chargePointId, ws);
                break;
            case 'SetChargingProfile':
                response = await (0, setChargingProfile_1.handleSetChargingProfile)(payload, chargePointId, ws);
                break;
            case 'TriggerMessage':
                response = await (0, triggerMessage_1.handleTriggerMessage)(payload, chargePointId, ws);
                break;
            case 'UnlockConnector':
                response = await (0, unlockConnector_1.handleUnlockConnector)(payload, chargePointId, ws);
                break;
            case 'UpdateFirmware':
                response = await (0, updateFirmware_1.handleUpdateFirmware)(payload, chargePointId, ws);
                break;
            case 'StartTransaction':
                response = await (0, startTransaction_1.handleStartTransaction)(payload, chargePointId, ws);
                break;
            case 'StopTransaction':
                response = await (0, stopTransaction_1.handleStopTransaction)(payload, chargePointId, ws);
                break;
            case 'SendLocalList':
                response = await (0, sendLocalList_1.handleSendLocalList)(payload, chargePointId, ws);
                break;
            default:
                response = { errorCode: 'NotImplemented', description: `Action ${action} not supported` };
        }
        let fullResponse;
        if (format === 'binary') {
            fullResponse = msgpack.encode([3, uniqueId, response]);
        }
        else {
            fullResponse = JSON.stringify([3, uniqueId, response]);
        }
        ws.send(fullResponse);
    }
    catch (err) {
        console.error(`Router parse error from ${chargePointId}: ${err.message}. Raw: ${data.toString()}`);
        // Безопасный CallError
        ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: err.message }]));
    }
}
