import WebSocket from "ws";
import * as msgpack from '@msgpack/msgpack';
import { logger } from "../logger";
import { manager } from "./index";
import { sendHeartbeat } from './messageSender';
import { sendStatusNotification } from './messageSender';
import { ClientManager } from './connectionManager'
import { BootNotificationResponse } from "../server/types/1.6/BootNotificationResponse";
import { HeartbeatResponse } from "../server/types/1.6/HeartbeatResponse";
import { AuthorizeResponse } from '../server/types/1.6/AuthorizeResponse';
import { GetConfigurationResponse } from '../server/types/1.6/GetConfigurationResponse';
import { StartTransactionResponse } from '../server/types/1.6/StartTransactionResponse';
import { StopTransactionResponse } from '../server/types/1.6/StopTransactionResponse';
import { StatusNotificationResponse } from "../server/types/1.6/StatusNotificationResponse"
import { MeterValuesResponse } from '../server/types/1.6/MeterValuesResponse';
import { RemoteStartTransactionResponse } from '../server/types/1.6/RemoteStartTransactionResponse'
import { RemoteStopTransactionResponse } from '../server/types/1.6/RemoteStopTransactionResponse'
import { ChangeConfigurationResponse } from '../server/types/1.6/ChangeConfigurationResponse'
import { ChargePointStatus } from '../utils/baseTypes';

let heartbeatInterval: NodeJS.Timeout;

export function handleResponse(data: Buffer, isBinary: boolean, ws: WebSocket) {
    let message: any;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        } catch (err) {
            logger.error(`Failed to decode MessagePack response: ${(err as any).message}`);
            return;
        }
    } else {
        try {
            message = JSON.parse(data.toString());
        } catch (err) {
            logger.error(`Failed to parse JSON response: ${(err as any).message}`);
            return;
        }
    }

    const [messageType, uniqueId, response] = message;

    if (messageType === 3) {  // CallResult от сервера
        // Обработка BootNotificationResponse
        if (response.status !== undefined && response.currentTime !== undefined) {
            const bootResp = response as BootNotificationResponse;
            if (bootResp.status === 'Accepted') {
                logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
                manager.updateInterval(bootResp.interval);

                // Запускаем heartbeat с интервалом от сервера
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
                heartbeatInterval = setInterval(() => sendHeartbeat(ws, {}, manager), bootResp.interval * 1000);

                // Отправляем начальное StatusNotification после успешного Boot
                sendStatusNotification(ws, {
                    connectorId: 1,
                    status: 'Available' as ChargePointStatus,
                    errorCode: 'NoError'
                }, manager);

            } else {
                logger.error(`Boot rejected: ${bootResp.status}`);
            }
        }

        // Обработка HeartbeatResponse
        else if (response.currentTime !== undefined && response.status === undefined) {
            const heartbeatResp = response as HeartbeatResponse;
            logger.info(`Heartbeat response: currentTime ${heartbeatResp.currentTime}`);
        }

        // Обработка AuthorizeResponse
        else if (response.idTagInfo !== undefined) {
            const authResp = response as AuthorizeResponse;
            if (authResp.idTagInfo.status === 'Accepted') {
                logger.info(`Authorization successful for idTag`);
                // Можно начинать транзакцию
            } else {
                logger.error(`Authorization failed: ${authResp.idTagInfo.status}`);
            }
        }

        // Обработка StartTransactionResponse
        else if (response.transactionId !== undefined) {
            const startResp = response as StartTransactionResponse;
            logger.info(`Transaction started: ID ${startResp.transactionId}`);

            if (startResp.idTagInfo.status === 'Accepted') {
                // Обновляем состояние станции
                if (manager.getState) {
                    manager.getState().startTransaction(startResp.transactionId);
                }

                // Отправляем StatusNotification о начале зарядки
                sendStatusNotification(ws, {
                    connectorId: 1, // Предполагаем, что знаем connectorId
                    status: 'Charging' as ChargePointStatus,
                    errorCode: 'NoError'
                }, manager);
            }
        }

        // Обработка StopTransactionResponse
        else if (response.idTagInfo !== undefined || Object.keys(response).length === 0) {
            const stopResp = response as StopTransactionResponse;
            logger.info(`Transaction stopped successfully`);

            // Обновляем состояние станции
            if (manager.getState) {
                manager.getState().stopTransaction();
            }

            // Отправляем StatusNotification о завершении
            sendStatusNotification(ws, {
                connectorId: 1,
                status: 'Finishing' as ChargePointStatus,
                errorCode: 'NoError'
            }, manager);

            // Через небольшой интервал возвращаемся в Available
            setTimeout(() => {
                sendStatusNotification(ws, {
                    connectorId: 1,
                    status: 'Available' as ChargePointStatus,
                    errorCode: 'NoError'
                }, manager);
            }, 5000);
        }

        // Обработка StatusNotificationResponse
        else if (Object.keys(response).length === 0) {
            logger.info(`StatusNotification confirmed by server`);
        }

        // Обработка MeterValuesResponse
        else if (response === undefined) {
            logger.info(`MeterValues confirmed by server`);
        }

        // Обработка RemoteStartTransactionResponse
        else if (response.status !== undefined) {
            const remoteStartResp = response as RemoteStartTransactionResponse;
            if (remoteStartResp.status === 'Accepted') {
                logger.info(`Remote start transaction accepted`);
            } else {
                logger.error(`Remote start transaction rejected`);
            }
        }

        // Обработка RemoteStopTransactionResponse
        else if (response.status !== undefined) {
            const remoteStopResp = response as RemoteStopTransactionResponse;
            if (remoteStopResp.status === 'Accepted') {
                logger.info(`Remote stop transaction accepted`);
            } else {
                logger.error(`Remote stop transaction rejected`);
            }
        }

        // Обработка ChangeConfigurationResponse
        else if (response.status !== undefined) {
            const changeConfigResp = response as ChangeConfigurationResponse;
            logger.info(`Configuration change status: ${changeConfigResp.status}`);
        }

        // Обработка GetConfigurationResponse
        else if (response.configurationKey !== undefined || response.unknownKey !== undefined) {
            const getConfigResp = response as GetConfigurationResponse;
            if (getConfigResp.configurationKey) {
                logger.info(`Retrieved ${getConfigResp.configurationKey.length} configuration keys`);
                getConfigResp.configurationKey.forEach(config => {
                    logger.info(`Config: ${config.key} = ${config.value} (readonly: ${config.readonly})`);
                });
            }
            if (getConfigResp.unknownKey) {
                logger.error(`Unknown configuration keys: ${getConfigResp.unknownKey.join(', ')}`);
            }
        }

        // Обработка формата сообщений от сервера
        if (response.format) {
            manager.setFormat(response.format);
            logger.info(`Server requested format change to: ${response.format}`);
        }

    } else if (messageType === 4) {  // CallError
        logger.error(`Error from server: ${response.errorCode || 'Unknown'} - ${response}`);

        // Останавливаем heartbeat при критических ошибках
        if (response.errorCode === 'SecurityError' || response.errorCode === 'FormationViolation') {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                logger.error('Critical error received, stopping heartbeat');
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
                logger.error(`Unknown action from server: ${action}`);
                // Отправляем ошибку "NotSupported"
                const errorMessage = [4, uniqueId, 'NotSupported', `Action ${action} is not supported`];
                ws.send(JSON.stringify(errorMessage));
        }
    }
}

// Обработчики входящих запросов от сервера
function handleRemoteStartTransaction(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received RemoteStartTransaction request for idTag: ${payload.idTag}`);

    // Проверяем, доступен ли коннектор
    if (manager.getState && manager.getState().getStatus() === 'Available') {
        // Отправляем положительный ответ
        const response = [3, uniqueId, { status: 'Accepted' }];
        ws.send(JSON.stringify(response));

        // Начинаем транзакцию
        // Здесь должна быть логика начала транзакции
        logger.info('Remote start transaction accepted');
    } else {
        // Отправляем отрицательный ответ
        const response = [3, uniqueId, { status: 'Rejected' }];
        ws.send(JSON.stringify(response));
        logger.error('Remote start transaction rejected - connector not available');
    }
}

function handleRemoteStopTransaction(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received RemoteStopTransaction request for transaction: ${payload.transactionId}`);

    // Проверяем, активна ли транзакция
    if (manager.getState && manager.getState().getCurrentTransaction() === payload.transactionId) {
        // Отправляем положительный ответ
        const response = [3, uniqueId, { status: 'Accepted' }];
        ws.send(JSON.stringify(response));

        // Останавливаем транзакцию
        // Здесь должна быть логика остановки транзакции
        logger.info('Remote stop transaction accepted');
    } else {
        // Отправляем отрицательный ответ
        const response = [3, uniqueId, { status: 'Rejected' }];
        ws.send(JSON.stringify(response));
        logger.error('Remote stop transaction rejected - transaction not found');
    }
}

function handleChangeConfiguration(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received ChangeConfiguration request for key: ${payload.key}, value: ${payload.value}`);

    // Здесь должна быть логика изменения конфигурации
    // Пока просто принимаем все изменения
    const response = [3, uniqueId, { status: 'Accepted' }];
    ws.send(JSON.stringify(response));
    logger.info('Configuration change accepted');
}

function handleGetConfiguration(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received GetConfiguration request for keys: ${payload.key?.join(', ') || 'all'}`);

    // Здесь должна быть логика получения конфигурации
    // Пока возвращаем пустой ответ
    const response = [3, uniqueId, { configurationKey: [] }];
    ws.send(JSON.stringify(response));
    logger.info('Configuration retrieved');
}

function handleReset(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received Reset request with type: ${payload.type}`);

    // Здесь должна быть логика сброса
    // Пока просто принимаем запрос
    const response = [3, uniqueId, { status: 'Accepted' }];
    ws.send(JSON.stringify(response));
    logger.info('Reset accepted');
}

function handleUnlockConnector(ws: WebSocket, uniqueId: string, payload: any) {
    logger.info(`Received UnlockConnector request for connector: ${payload.connectorId}`);

    // Здесь должна быть логика разблокировки
    // Пока просто принимаем запрос
    const response = [3, uniqueId, { status: 'Unlocked' }];
    ws.send(JSON.stringify(response));
    logger.info('Connector unlocked');
}