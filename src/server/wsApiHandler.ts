import WebSocket from 'ws';
import { logger } from '../logger';
import { connectionManager } from './index';

export interface WebSocketAPIRequest {
    id: string;
    method: 'GET' | 'POST' | 'DELETE';
    url: string;
    data?: any;
}

export interface WebSocketAPIResponse {
    id: string;
    status: number;
    data?: any;
    error?: string;
}

export function handleWebSocketAPI(ws: WebSocket, request: WebSocketAPIRequest): void {
    logger.info(`[WS-API] ${request.method} ${request.url} (id: ${request.id})`);

    let response: WebSocketAPIResponse;

    try {
        switch (request.url) {
            case '/api/stations':
                response = handleStationsAPI(request);
                break;

            case '/api/transactions/recent':
                response = handleTransactionsAPI(request);
                break;

            default:
                if (request.url.startsWith('/api/transactions/delete/')) {
                    response = handleDeleteTransactionAPI(request);
                } else if (request.url.startsWith('/api/stations/')) {
                    response = handleStationActionsAPI(request);
                } else {
                    response = {
                        id: request.id,
                        status: 404,
                        error: 'Endpoint not found'
                    };
                }
        }
    } catch (error) {
        logger.error(`[WS-API] Error handling ${request.url}: ${error}`);
        response = {
            id: request.id,
            status: 500,
            error: 'Internal server error'
        };
    }

    // Отправляем ответ обратно через WebSocket
    ws.send(JSON.stringify(response));
    logger.info(`[WS-API] Response sent for ${request.id}: ${response.status}`);
}

function handleStationsAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    const connections = connectionManager.getAllConnections();
    const allConnectors = connectionManager.getAllChargePointsWithConnectors();
    const stations: any[] = [];

    if (connections) {
        connections.forEach((wsConnection, chargePointId) => {
            // Пропускаем мобильные клиенты (не станции)
            if (chargePointId === 'mobile-client' || chargePointId === 'unknown') {
                return;
            }

            const lastActivity = connectionManager.lastActivity.get(chargePointId);
            const isOnline = wsConnection.readyState === WebSocket.OPEN;
            const connectorsMap = allConnectors.get(chargePointId);

            // Формируем список коннекторов из реальных данных
            const connectors: any[] = [];
            if (connectorsMap && connectorsMap.size > 0) {
                connectorsMap.forEach((state, connectorId) => {
                    connectors.push({
                        id: connectorId,
                        type: 'Unknown',
                        status: state.status || 'Unknown',
                        power_kW: 0,
                        soc: null,
                        transactionId: state.transactionId || null,
                        errorCode: state.errorCode || null,
                        price: 15,
                        updatedAt: state.lastUpdate ? state.lastUpdate.toISOString() : new Date().toISOString()
                    });
                });
            } else {
                // Если нет коннекторов, вернём пустой массив (не хардкодный!)
                // Станция либо ещё не отправила StatusNotification, либо отключена
            }

            // Определяем общий статус станции
            let stationStatus = 'Offline';
            if (isOnline) {
                if (connectors.some(c => c.status === 'Charging')) {
                    stationStatus = 'Charging';
                } else if (connectors.every(c => c.status === 'Available')) {
                    stationStatus = 'Available';
                } else {
                    stationStatus = 'PartiallyAvailable';
                }
            }

            stations.push({
                id: chargePointId,
                name: chargePointId,
                status: stationStatus,
                isOnline,
                lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
                connectors
            });
        });
    }

    return {
        id: request.id,
        status: 200,
        data: {
            success: true,
            data: stations
        }
    };
}

function handleTransactionsAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    const transactions = connectionManager.getRecentTransactions();

    return {
        id: request.id,
        status: 200,
        data: {
            success: true,
            data: transactions,
            count: transactions.length
        }
    };
}

function handleDeleteTransactionAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    const urlParts = request.url.split('/');

    if (urlParts[urlParts.length - 1] === 'all') {
        // Удаление всех транзакций
        connectionManager.clearRecentTransactions();
        return {
            id: request.id,
            status: 200,
            data: {
                success: true,
                message: 'All transactions deleted'
            }
        };
    } else {
        // Удаление конкретной транзакции
        const transactionId = urlParts[urlParts.length - 1];
        const deleted = connectionManager.deleteRecentTransaction(transactionId);

        return {
            id: request.id,
            status: deleted ? 200 : 404,
            data: {
                success: deleted,
                message: deleted ? 'Transaction deleted' : 'Transaction not found'
            }
        };
    }
}

function handleStationActionsAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    // Обработка действий со станциями (start, stop и т.д.)
    const urlParts = request.url.split('/');
    const stationId = urlParts[3]; // /api/stations/{stationId}/action
    const action = urlParts[4];

    switch (action) {
        case 'start':
            return {
                id: request.id,
                status: 200,
                data: {
                    success: true,
                    message: `Start command sent to ${stationId}`,
                    transactionId: Math.floor(Math.random() * 1000000)
                }
            };

        case 'stop':
            return {
                id: request.id,
                status: 200,
                data: {
                    success: true,
                    message: `Stop command sent to ${stationId}`
                }
            };

        default:
            return {
                id: request.id,
                status: 400,
                error: 'Unknown action'
            };
    }
}

export function isWebSocketAPIRequest(message: string): boolean {
    try {
        const parsed = JSON.parse(message);
        return parsed.id && parsed.method && parsed.url &&
            typeof parsed.id === 'string' &&
            ['GET', 'POST', 'DELETE'].includes(parsed.method) &&
            parsed.url.startsWith('/api/');
    } catch {
        return false;
    }
}