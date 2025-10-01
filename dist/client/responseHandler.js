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
const messageSender_2 = require("./messageSender");
let heartbeatInterval;
function handleResponse(data, isBinary, ws) {
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
    const [messageType, uniqueId, response] = message;
    if (messageType === 3) { // CallResult от сервера
        // Обработка BootNotificationResponse
        if (response.status !== undefined && response.currentTime !== undefined) {
            const bootResp = response;
            if (bootResp.status === 'Accepted') {
                logger_1.logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
                index_1.manager.updateInterval(bootResp.interval);
                // Запускаем heartbeat с интервалом от сервера
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
                heartbeatInterval = setInterval(() => (0, messageSender_1.sendHeartbeat)(ws, {}, index_1.manager), bootResp.interval * 1000);
                // Отправляем начальное StatusNotification после успешного Boot
                (0, messageSender_2.sendStatusNotification)(ws, {
                    connectorId: 1,
                    status: 'Available',
                    errorCode: 'NoError'
                }, index_1.manager);
            }
            else {
                logger_1.logger.error(`Boot rejected: ${bootResp.status}`);
            }
        }
        // Обработка HeartbeatResponse
        else if (response.currentTime !== undefined && response.status === undefined) {
            const heartbeatResp = response;
            logger_1.logger.info(`Heartbeat response: currentTime ${heartbeatResp.currentTime}`);
        }
        // Обработка AuthorizeResponse
        else if (response.idTagInfo !== undefined) {
            const authResp = response;
            if (authResp.idTagInfo.status === 'Accepted') {
                logger_1.logger.info(`Authorization successful for idTag`);
                // Можно начинать транзакцию
            }
            else {
                logger_1.logger.error(`Authorization failed: ${authResp.idTagInfo.status}`);
            }
        }
        // Обработка StartTransactionResponse
        else if (response.transactionId !== undefined) {
            const startResp = response;
            logger_1.logger.info(`Transaction started: ID ${startResp.transactionId}`);
            if (startResp.idTagInfo.status === 'Accepted') {
                // Обновляем состояние станции
                if (index_1.manager.getState) {
                    index_1.manager.getState().startTransaction(startResp.transactionId);
                }
                // Отправляем StatusNotification о начале зарядки
                (0, messageSender_2.sendStatusNotification)(ws, {
                    connectorId: 1, // Предполагаем, что знаем connectorId
                    status: 'Charging',
                    errorCode: 'NoError'
                }, index_1.manager);
            }
        }
        // Обработка StopTransactionResponse
        else if (response.idTagInfo !== undefined || Object.keys(response).length === 0) {
            const stopResp = response;
            logger_1.logger.info(`Transaction stopped successfully`);
            // Обновляем состояние станции
            if (index_1.manager.getState) {
                index_1.manager.getState().stopTransaction();
            }
            // Отправляем StatusNotification о завершении
            (0, messageSender_2.sendStatusNotification)(ws, {
                connectorId: 1,
                status: 'Finishing',
                errorCode: 'NoError'
            }, index_1.manager);
            // Через небольшой интервал возвращаемся в Available
            setTimeout(() => {
                (0, messageSender_2.sendStatusNotification)(ws, {
                    connectorId: 1,
                    status: 'Available',
                    errorCode: 'NoError'
                }, index_1.manager);
            }, 5000);
        }
        // Обработка StatusNotificationResponse
        else if (Object.keys(response).length === 0) {
            logger_1.logger.info(`StatusNotification confirmed by server`);
        }
        // Обработка MeterValuesResponse
        else if (response === undefined) {
            logger_1.logger.info(`MeterValues confirmed by server`);
        }
        // Обработка RemoteStartTransactionResponse
        else if (response.status !== undefined) {
            const remoteStartResp = response;
            if (remoteStartResp.status === 'Accepted') {
                logger_1.logger.info(`Remote start transaction accepted`);
            }
            else {
                logger_1.logger.error(`Remote start transaction rejected`);
            }
        }
        // Обработка RemoteStopTransactionResponse
        else if (response.status !== undefined) {
            const remoteStopResp = response;
            if (remoteStopResp.status === 'Accepted') {
                logger_1.logger.info(`Remote stop transaction accepted`);
            }
            else {
                logger_1.logger.error(`Remote stop transaction rejected`);
            }
        }
        // Обработка ChangeConfigurationResponse
        else if (response.status !== undefined) {
            const changeConfigResp = response;
            logger_1.logger.info(`Configuration change status: ${changeConfigResp.status}`);
        }
        // Обработка GetConfigurationResponse
        else if (response.configurationKey !== undefined || response.unknownKey !== undefined) {
            const getConfigResp = response;
            if (getConfigResp.configurationKey) {
                logger_1.logger.info(`Retrieved ${getConfigResp.configurationKey.length} configuration keys`);
                getConfigResp.configurationKey.forEach(config => {
                    logger_1.logger.info(`Config: ${config.key} = ${config.value} (readonly: ${config.readonly})`);
                });
            }
            if (getConfigResp.unknownKey) {
                logger_1.logger.error(`Unknown configuration keys: ${getConfigResp.unknownKey.join(', ')}`);
            }
        }
        // Обработка формата сообщений от сервера
        if (response.format) {
            index_1.manager.setFormat(response.format);
            logger_1.logger.info(`Server requested format change to: ${response.format}`);
        }
    }
    else if (messageType === 4) { // CallError
        logger_1.logger.error(`Error from server: ${response.errorCode || 'Unknown'} - ${response}`);
        // Останавливаем heartbeat при критических ошибках
        if (response.errorCode === 'SecurityError' || response.errorCode === 'FormationViolation') {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                logger_1.logger.error('Critical error received, stopping heartbeat');
            }
        }
    }
    // Обработка входящих запросов от сервера (messageType === 2)
    else if (messageType === 2) {
        const [_, uniqueId, action, payload] = message;
        switch (action) {
            case 'RemoteStartTransaction':
                handleRemoteStartTransaction(ws, uniqueId, payload);
                break;
            case 'RemoteStopTransaction':
                handleRemoteStopTransaction(ws, uniqueId, payload);
                break;
            case 'ChangeConfiguration':
                handleChangeConfiguration(ws, uniqueId, payload);
                break;
            case 'GetConfiguration':
                handleGetConfiguration(ws, uniqueId, payload);
                break;
            case 'Reset':
                handleReset(ws, uniqueId, payload);
                break;
            case 'UnlockConnector':
                handleUnlockConnector(ws, uniqueId, payload);
                break;
            default:
                logger_1.logger.error(`Unknown action from server: ${action}`);
                // Отправляем ошибку "NotSupported"
                const errorMessage = [4, uniqueId, 'NotSupported', `Action ${action} is not supported`];
                ws.send(JSON.stringify(errorMessage));
        }
    }
}
// Обработчики входящих запросов от сервера
function handleRemoteStartTransaction(ws, uniqueId, payload) {
    logger_1.logger.info(`Received RemoteStartTransaction request for idTag: ${payload.idTag}`);
    // Проверяем, доступен ли коннектор
    if (index_1.manager.getState && index_1.manager.getState().getStatus() === 'Available') {
        // Отправляем положительный ответ
        const response = [3, uniqueId, { status: 'Accepted' }];
        ws.send(JSON.stringify(response));
        // Начинаем транзакцию
        // Здесь должна быть логика начала транзакции
        logger_1.logger.info('Remote start transaction accepted');
    }
    else {
        // Отправляем отрицательный ответ
        const response = [3, uniqueId, { status: 'Rejected' }];
        ws.send(JSON.stringify(response));
        logger_1.logger.error('Remote start transaction rejected - connector not available');
    }
}
function handleRemoteStopTransaction(ws, uniqueId, payload) {
    logger_1.logger.info(`Received RemoteStopTransaction request for transaction: ${payload.transactionId}`);
    // Проверяем, активна ли транзакция
    if (index_1.manager.getState && index_1.manager.getState().getCurrentTransaction() === payload.transactionId) {
        // Отправляем положительный ответ
        const response = [3, uniqueId, { status: 'Accepted' }];
        ws.send(JSON.stringify(response));
        // Останавливаем транзакцию
        // Здесь должна быть логика остановки транзакции
        logger_1.logger.info('Remote stop transaction accepted');
    }
    else {
        // Отправляем отрицательный ответ
        const response = [3, uniqueId, { status: 'Rejected' }];
        ws.send(JSON.stringify(response));
        logger_1.logger.error('Remote stop transaction rejected - transaction not found');
    }
}
function handleChangeConfiguration(ws, uniqueId, payload) {
    logger_1.logger.info(`Received ChangeConfiguration request for key: ${payload.key}, value: ${payload.value}`);
    // Здесь должна быть логика изменения конфигурации
    // Пока просто принимаем все изменения
    const response = [3, uniqueId, { status: 'Accepted' }];
    ws.send(JSON.stringify(response));
    logger_1.logger.info('Configuration change accepted');
}
function handleGetConfiguration(ws, uniqueId, payload) {
    logger_1.logger.info(`Received GetConfiguration request for keys: ${payload.key?.join(', ') || 'all'}`);
    // Здесь должна быть логика получения конфигурации
    // Пока возвращаем пустой ответ
    const response = [3, uniqueId, { configurationKey: [] }];
    ws.send(JSON.stringify(response));
    logger_1.logger.info('Configuration retrieved');
}
function handleReset(ws, uniqueId, payload) {
    logger_1.logger.info(`Received Reset request with type: ${payload.type}`);
    // Здесь должна быть логика сброса
    // Пока просто принимаем запрос
    const response = [3, uniqueId, { status: 'Accepted' }];
    ws.send(JSON.stringify(response));
    logger_1.logger.info('Reset accepted');
}
function handleUnlockConnector(ws, uniqueId, payload) {
    logger_1.logger.info(`Received UnlockConnector request for connector: ${payload.connectorId}`);
    // Здесь должна быть логика разблокировки
    // Пока просто принимаем запрос
    const response = [3, uniqueId, { status: 'Unlocked' }];
    ws.send(JSON.stringify(response));
    logger_1.logger.info('Connector unlocked');
}
