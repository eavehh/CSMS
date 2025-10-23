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
const ajvValidator_1 = require("../utils/ajvValidator");
const wsApiHandler_1 = require("./wsApiHandler");
// Sec 4: Charge Point initiated
const authorize_1 = require("./handlers/authorize");
const bootNotification_1 = require("./handlers/bootNotification");
const dataTransfer_1 = require("./handlers/dataTransfer");
const diagnosticsStatusNotification_1 = require("./handlers/diagnosticsStatusNotification");
const firmwareStatusNotification_1 = require("./handlers/firmwareStatusNotification");
const heartbeat_1 = require("./handlers/heartbeat");
const meterValues_1 = require("./handlers/meterValues");
const startTransaction_1 = require("./handlers/startTransaction");
const statusNotification_1 = require("./handlers/statusNotification");
const stopTransaction_1 = require("./handlers/stopTransaction");
// Sec 5: Central initiated
const cancelReservation_1 = require("./handlers/cancelReservation");
const changeAvailability_1 = require("./handlers/changeAvailability");
const changeConfiguration_1 = require("./handlers/changeConfiguration");
const clearCache_1 = require("./handlers/clearCache");
const clearChargingProfile_1 = require("./handlers/clearChargingProfile");
const getCompositeSchedule_1 = require("./handlers/getCompositeSchedule");
const getDiagnostics_1 = require("./handlers/getDiagnostics");
const getLocalListVersion_1 = require("./handlers/getLocalListVersion");
const remoteStartTransaction_1 = require("./handlers/remoteStartTransaction");
const remoteStopTransaction_1 = require("./handlers/remoteStopTransaction");
const reserveNow_1 = require("./handlers/reserveNow");
const reset_1 = require("./handlers/reset");
const sendLocalList_1 = require("./handlers/sendLocalList");
const setChargingProfile_1 = require("./handlers/setChargingProfile");
const triggerMessage_1 = require("./handlers/triggerMessage");
const unlockConnector_1 = require("./handlers/unlockConnector");
const updateFirmware_1 = require("./handlers/updateFirmware");
const getConfiguration_1 = require("./handlers/getConfiguration");
async function handleMessage(data, isBinary, ws, chargePointId) {
    let message;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        }
        catch (err) {
            logger_1.logger.error(`[MessageRouter] Failed to decode MessagePack message from ${chargePointId}: ${err.message}`);
            ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid MessagePack' }]));
            return;
        }
    }
    else {
        try {
            const messageText = data.toString();
            // 🔥 Проверяем, это WebSocket API запрос или OCPP сообщение
            if ((0, wsApiHandler_1.isWebSocketAPIRequest)(messageText)) {
                logger_1.logger.info(`[MessageRouter] WebSocket API request from ${chargePointId}`);
                const apiRequest = JSON.parse(messageText);
                (0, wsApiHandler_1.handleWebSocketAPI)(ws, apiRequest);
                return;
            }
            message = JSON.parse(messageText);
        }
        catch (err) {
            logger_1.logger.error(`[MessageRouter] Failed to parse JSON message from ${chargePointId}: ${err.message}`);
            ws.send(JSON.stringify([4, null, { errorCode: 'FormationViolation', description: 'Invalid JSON' }]));
            return;
        }
    }
    try {
        const [messageType, uniqueId, actionOrPayload, payloadOrNothing] = message;
        const format = index_1.connectionManager.getFormat(chargePointId);
        index_1.connectionManager.updateLastActivity(chargePointId); // Обновляем активность
        // Валидация (только для type 2 — запросов от клиента)
        if (messageType === 2) {
            logger_1.logger.info(`[MessageRouter] from ${chargePointId} Received request: ${actionOrPayload}`);
            // Skip validation for MeterValues to be tolerant to non-standard formats
            const skipValidation = actionOrPayload === 'MeterValues';
            if (!skipValidation) {
                const validation = (0, ajvValidator_1.validateMessage)(actionOrPayload, `${actionOrPayload}`);
                if (!validation) {
                    logger_1.logger.error(`[MessageRouter] Validation failed for ${actionOrPayload} from ${chargePointId}`);
                    const errorResponse = {
                        errorCode: 'FormationViolation',
                        description: 'Invalid payload',
                        errorDetails: 'Payload does not match OCPP schema'
                    };
                    const fullError = [4, uniqueId, errorResponse];
                    if (format === 'binary') {
                        ws.send(msgpack.encode(fullError));
                    }
                    else {
                        ws.send(JSON.stringify(fullError));
                    }
                    return;
                }
            }
            else {
                logger_1.logger.debug(`[MessageRouter] Skipping validation for ${actionOrPayload} (tolerant mode)`);
            }
            // Если в payload флаг смены формата (опционально)
            if (actionOrPayload.format) {
                index_1.connectionManager.setFormat(chargePointId, actionOrPayload.format);
            }
            // Обработка запросов от клиента (type 2)
            let response;
            switch (actionOrPayload) {
                case 'BootNotification':
                    response = await (0, bootNotification_1.handleBootNotification)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[BootNotification Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'Authorize':
                    response = await (0, authorize_1.handleAuthorize)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[Authorize Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'Heartbeat':
                    response = await (0, heartbeat_1.handleHeartbeat)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[Heartbeat Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'StatusNotification':
                    response = await (0, statusNotification_1.handleStatusNotification)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[StatusNotification Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'DataTransfer':
                    response = await (0, dataTransfer_1.handleDataTransfer)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[DataTransfer Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'DiagnosticsStatusNotification':
                    response = await (0, diagnosticsStatusNotification_1.handleDiagnosticsStatusNotification)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[DiagnosticsStatusNotification Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'FirmwareStatusNotification':
                    response = await (0, firmwareStatusNotification_1.handleFirmwareStatusNotification)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[FirmwareStatusNotification Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'MeterValues':
                    response = await (0, meterValues_1.handleMeterValues)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[MeterValues Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'StartTransaction':
                    response = await (0, startTransaction_1.handleStartTransaction)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[StartTransaction Handled] response=${JSON.stringify(response)}`);
                    break;
                case 'StopTransaction':
                    response = await (0, stopTransaction_1.handleStopTransaction)(payloadOrNothing, chargePointId, ws);
                    logger_1.logger.info(`[StopTransaction Handled] response=${JSON.stringify(response)}`);
                    break;
                default:
                    response = { errorCode: 'NotImplemented', description: `Action ${actionOrPayload} not supported` };
                    logger_1.logger.warn(`Unhandled action from ${chargePointId}: ${actionOrPayload}`);
            }
            // Отправка ответа (type 3)
            const fullResponse = format === 'binary' ? msgpack.encode([3, uniqueId, response]) : JSON.stringify([3, uniqueId, response]);
            ws.send(fullResponse);
            logger_1.logger.info(`[MeesageRouter] Response Sent type 3 to ${chargePointId}: ${JSON.stringify(response)}`);
        }
        else if (messageType === 3) { // Ответы от клиента на наши команды (type 2)
            logger_1.logger.info(`[MeesageRouter] Response Received type 3 from ${chargePointId}: payload=${JSON.stringify(actionOrPayload)}`);
            // Корреляция по uniqueId (используйте pendingRequests из ConnectionManager)
            const requestAction = index_1.connectionManager.getAndClearPendingRequest(uniqueId);
            if (!requestAction) {
                logger_1.logger.warn(`[MeesageRouter] Received response for UNKNOWN request ID: ${uniqueId} from ${chargePointId}`);
                return;
            }
            const responsePayload = actionOrPayload; // Payload ответа (e.g., {status: 'Accepted'})
            // Обработка ответов (switch на requestAction)
            switch (requestAction) {
                case 'ReserveNow':
                    await (0, reserveNow_1.handleReserveNow)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[ReserveNow Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'CancelReservation':
                    await (0, cancelReservation_1.handleCancelReservation)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[CancelReservation Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'ChangeAvailability':
                    await (0, changeAvailability_1.handleChangeAvailability)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[ChangeAvailability Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'ChangeConfiguration':
                    await (0, changeConfiguration_1.handleChangeConfiguration)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[ChangeConfiguration Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'ClearCache':
                    await (0, clearCache_1.handleClearCache)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[ClearCache Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'ClearChargingProfile':
                    await (0, clearChargingProfile_1.handleClearChargingProfile)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[ClearChargingProfile Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'GetCompositeSchedule':
                    await (0, getCompositeSchedule_1.handleGetCompositeSchedule)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[GetCompositeSchedule Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'GetConfiguration':
                    await (0, getConfiguration_1.handleGetConfiguration)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[GetConfiguration Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'GetDiagnostics':
                    await (0, getDiagnostics_1.handleGetDiagnostics)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[GetDiagnostics Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'GetLocalListVersion':
                    await (0, getLocalListVersion_1.handleGetLocalListVersion)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[GetLocalListVersion Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'RemoteStartTransaction':
                    await (0, remoteStartTransaction_1.handleRemoteStartTransaction)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[RemoteStartTransaction Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'RemoteStopTransaction':
                    await (0, remoteStopTransaction_1.handleRemoteStopTransaction)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[RemoteStopTransaction Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'Reset':
                    await (0, reset_1.handleReset)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[Reset Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'SendLocalList':
                    await (0, sendLocalList_1.handleSendLocalList)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[SendLocalList Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'SetChargingProfile':
                    await (0, setChargingProfile_1.handleSetChargingProfile)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[SetChargingProfile Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'TriggerMessage':
                    await (0, triggerMessage_1.handleTriggerMessage)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[TriggerMessage Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'UnlockConnector':
                    await (0, unlockConnector_1.handleUnlockConnector)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[UnlockConnector Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                case 'UpdateFirmware':
                    await (0, updateFirmware_1.handleUpdateFirmware)(responsePayload, chargePointId, ws);
                    logger_1.logger.info(`[UpdateFirmware Handled] response=${JSON.stringify(responsePayload)}`);
                    break;
                default:
                    logger_1.logger.warn(`[MessageRouter] Unhandled response for action ${requestAction} from ${chargePointId}`);
            }
        }
        else if (messageType === 4) { // CallError от клиента
            logger_1.logger.error(`[MessageRouter] CallError from ${chargePointId}: ${JSON.stringify(actionOrPayload)}; deleting pending`);
            index_1.connectionManager.getAndClearPendingRequest(uniqueId);
        }
        else {
            logger_1.logger.warn(`[MessageRouter] Unknown Type ${messageType} from ${chargePointId}: ${JSON.stringify(message)}`);
        }
    }
    catch (err) {
        logger_1.logger.error(`[MessageRouter] Router parse error from ${chargePointId}: ${err.message}. MESSAGE: ${data.toString()}`);
        // Безопасный CallError
        ws.send(JSON.stringify([4, null, { errorCode: 'GenericError', description: err.message }]));
    }
}
