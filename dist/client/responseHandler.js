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
exports.handleResponse = handleResponse;
const msgpack = __importStar(require("@msgpack/msgpack"));
const logger_1 = require("../logger");
const index_1 = require("./index");
const messageSender_1 = require("./messageSender");
let heartbeatInterval;
let statusTimeout; // Для Finishing → Available
function handleResponse(data, isBinary, ws) {
    logger_1.logger.info(`[RAW] <<< ${data.toString()}`);
    let message;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        }
        catch (err) {
            logger_1.logger.error(`Failed to decode MessagePack response: ${err.message}`);
            return;
        }
    }
    else {
        try {
            message = JSON.parse(data.toString());
        }
        catch (err) {
            logger_1.logger.error(`Failed to parse JSON response: ${err.message}`);
            return;
        }
    }
    const [messageType, uniqueId, actionOrResponse, ResponseOrNothing] = message;
    logger_1.logger.info(`Response received: type ${messageType}, uniqueId ${uniqueId}}`);
    if (messageType === 3) { // CallResult от сервера
        const response = actionOrResponse;
        if (response?.format) {
            index_1.manager.setFormat(response.format);
        }
        // BootResponse (status + currentTime)
        if (response.status !== undefined && response.currentTime !== undefined) {
            const bootResp = response;
            if (bootResp.status === 'Accepted') {
                logger_1.logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
                index_1.manager.updateInterval(bootResp.interval);
                // Начальное StatusNotification (Available)
                (0, messageSender_1.sendStatusNotification)(ws, {
                    connectorId: 1,
                    status: 'Available',
                    errorCode: 'NoError'
                }, index_1.manager);
            }
            else {
                logger_1.logger.error(`Boot rejected: ${bootResp.status}`);
            }
        }
        // HeartbeatResponse (только currentTime)
        else if (response.currentTime !== undefined && response.status === undefined) {
            const heartbeatResp = response;
            logger_1.logger.info(`Heartbeat response: currentTime ${heartbeatResp.currentTime}`);
        }
        // AuthorizeResponse (idTagInfo)
        else if (response.idTagInfo !== undefined && response.status === undefined) {
            const authResp = response;
            if (authResp.idTagInfo.status === 'Accepted') {
                logger_1.logger.info(`Authorization successful for idTag`);
                // Начинай tx
                (0, messageSender_1.sendStartTransaction)(ws, { connectorId: 1, idTag: 'USER_123', meterStart: 0, timestamp: new Date().toISOString() }, index_1.manager);
            }
            else {
                logger_1.logger.error(`Authorization failed: ${authResp.idTagInfo.status}`);
            }
        }
        // StartTransactionResponse (transactionId + idTagInfo)
        else if (response.transactionId !== undefined && response.idTagInfo !== undefined) {
            const startResp = response;
            logger_1.logger.info(`Transaction started: ID ${startResp.transactionId}`);
            if (startResp.idTagInfo.status === 'Accepted') {
                index_1.manager.getState(1).startTransaction(startResp.transactionId); // Обнови state
                // StatusNotification Charging
                (0, messageSender_1.sendStatusNotification)(ws, {
                    connectorId: 1,
                    status: 'Charging',
                    errorCode: 'NoError'
                }, index_1.manager);
            }
        }
        // StopTransactionResponse (idTagInfo или {})
        else if (response.idTagInfo !== undefined || Object.keys(response).length === 0) {
            const stopResp = response;
            logger_1.logger.info(`Transaction stopped successfully`);
            index_1.manager.getState(1).stopTransaction(); // Обнови state
            // StatusNotification Finishing
            (0, messageSender_1.sendStatusNotification)(ws, {
                connectorId: 1,
                status: 'Finishing',
                errorCode: 'NoError'
            }, index_1.manager);
            if (statusTimeout)
                clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
                const state = index_1.manager.getState(1);
                if (state?.status === 'Finishing') {
                    (0, messageSender_1.sendStatusNotification)(ws, {
                        connectorId: 1,
                        status: 'Available',
                        errorCode: 'NoError'
                    }, index_1.manager);
                }
            }, 2000);
            // MeterValuesResponse / StatusNotificationResponse (пустой {})
        }
        else if (Object.keys(response).length === 0) {
            logger_1.logger.info(`MeterValues/StatusNotification confirmed`);
        }
        // RemoteStartTransactionResponse (status)
        else if (response.status !== undefined && response.transactionId === undefined) {
            const remoteStartResp = response;
            if (remoteStartResp.status === 'Accepted') {
                logger_1.logger.info(`Remote start accepted`);
                // Логика remote start
            }
            else {
                logger_1.logger.error(`Remote start rejected: ${remoteStartResp.status}`);
            }
        }
        // RemoteStopTransactionResponse (status)
        else if (response.status !== undefined && response.idTagInfo === undefined) {
            const remoteStopResp = response;
            if (remoteStopResp.status === 'Accepted') {
                logger_1.logger.info(`Remote stop accepted`);
                // Логика remote stop
            }
            else {
                logger_1.logger.error(`Remote stop rejected: ${remoteStopResp.status}`);
            }
        }
        // ChangeConfigurationResponse (status)
        else if (response.status !== undefined && response.configurationKey === undefined) {
            const changeConfigResp = response;
            logger_1.logger.info(`Configuration change status: ${changeConfigResp.status}`);
        }
        // GetConfigurationResponse (configurationKey)
        else if (response.configurationKey !== undefined) {
            const getConfigResp = response;
            logger_1.logger.info(`Retrieved ${getConfigResp.configurationKey.length} config keys`);
            getConfigResp.configurationKey.forEach(config => {
                logger_1.logger.info(`Config: ${config.key} = ${config.value} (readonly: ${config.readonly})`);
            });
            if (getConfigResp.unknownKey) {
                logger_1.logger.error(`Unknown keys: ${getConfigResp.unknownKey.join(', ')}`);
            }
        }
    }
    // callError
    else if (messageType === 4) { // CallError
        const error = actionOrResponse;
        logger_1.logger.error(`Error from server: ${error.errorCode || 'Unknown'} - ${error.description || ''}`);
        if (heartbeatInterval)
            clearInterval(heartbeatInterval);
    }
    // Входящие от сервера (type 2, Central initiated)
    else if (messageType === 2) {
        const action = actionOrResponse;
        const payload = ResponseOrNothing;
        switch (action) {
            case 'RemoteStartTransaction':
                handleRemoteStartTransaction(ws, uniqueId, payload, index_1.manager);
                break;
            case 'RemoteStopTransaction':
                handleRemoteStopTransaction(ws, uniqueId, payload, index_1.manager);
                break;
            case 'ChangeConfiguration':
                handleChangeConfiguration(ws, uniqueId, payload, index_1.manager);
                break;
            case 'GetConfiguration':
                handleGetConfiguration(ws, uniqueId, payload, index_1.manager);
                break;
            case 'Reset':
                handleReset(ws, uniqueId, payload, index_1.manager);
                break;
            case 'UnlockConnector':
                handleUnlockConnector(ws, uniqueId, payload, index_1.manager);
                break;
            default:
                logger_1.logger.error(`Unknown action from server: ${action}`);
                ws.send(JSON.stringify([4, uniqueId, { errorCode: 'NotImplemented', description: `Action ${action} not supported` }]));
        }
    }
}
// Обработчики type 2 (входящие от сервера)
function handleRemoteStartTransaction(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received RemoteStartTransaction for idTag: ${payload.idTag}`);
    const connector = manager.getAvailableConnector();
    if (connector) {
        // Accepted, start tx
        ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
        (0, messageSender_1.sendStartTransaction)(ws, { connectorId: connector.getConnectorId(), idTag: payload.idTag, meterStart: 0, timestamp: new Date().toISOString() }, manager);
    }
    else {
        ws.send(JSON.stringify([3, uniqueId, { status: 'Rejected' }]));
    }
}
function handleRemoteStopTransaction(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received RemoteStopTransaction for tx: ${payload.transactionId}`);
    const state = manager.getState(1);
    if (state.getCurrentTransaction() === payload.transactionId) {
        ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
        state.stopTransaction();
    }
    else {
        ws.send(JSON.stringify([3, uniqueId, { status: 'Rejected' }]));
    }
}
function handleChangeConfiguration(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received ChangeConfiguration for key: ${payload.key}`);
    // Сохрани в state или config
    ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
}
function handleGetConfiguration(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received GetConfiguration for keys: ${payload.key?.join(', ')}`);
    const config = { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '60' }] };
    ws.send(JSON.stringify([3, uniqueId, config]));
}
function handleReset(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received Reset: ${payload.type}`);
    // Reset logic
    ws.send(JSON.stringify([3, uniqueId, { status: 'Accepted' }]));
}
function handleUnlockConnector(ws, uniqueId, payload, manager) {
    logger_1.logger.info(`Received UnlockConnector for connector: ${payload.connectorId}`);
    ws.send(JSON.stringify([3, uniqueId, 'Unlocked']));
}
