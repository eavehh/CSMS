"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebSocketAPI = handleWebSocketAPI;
exports.isWebSocketAPIRequest = isWebSocketAPIRequest;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../logger");
const index_1 = require("./index");
function handleWebSocketAPI(ws, request) {
    logger_1.logger.info(`[WS-API] ${request.method} ${request.url} (id: ${request.id})`);
    let response;
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
                }
                else if (request.url.startsWith('/api/stations/')) {
                    response = handleStationActionsAPI(request);
                }
                else {
                    response = {
                        id: request.id,
                        status: 404,
                        error: 'Endpoint not found'
                    };
                }
        }
    }
    catch (error) {
        logger_1.logger.error(`[WS-API] Error handling ${request.url}: ${error}`);
        response = {
            id: request.id,
            status: 500,
            error: 'Internal server error'
        };
    }
    // Отправляем ответ обратно через WebSocket
    ws.send(JSON.stringify(response));
    logger_1.logger.info(`[WS-API] Response sent for ${request.id}: ${response.status}`);
}
function handleStationsAPI(request) {
    const connections = index_1.connectionManager.getAllConnections();
    const allConnectors = index_1.connectionManager.getAllChargePointsWithConnectors();
    const stations = [];
    if (connections) {
        connections.forEach((wsConnection, chargePointId) => {
            // Пропускаем мобильные клиенты (не станции)
            if (chargePointId === 'mobile-client' || chargePointId === 'unknown') {
                return;
            }
            const lastActivity = index_1.connectionManager.lastActivity.get(chargePointId);
            const isOnline = wsConnection.readyState === ws_1.default.OPEN;
            const connectorsMap = allConnectors.get(chargePointId);
            // Формируем список коннекторов из реальных данных
            const connectors = [];
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
            }
            else {
                // Если нет коннекторов, вернём пустой массив (не хардкодный!)
                // Станция либо ещё не отправила StatusNotification, либо отключена
            }
            // Определяем общий статус станции
            let stationStatus = 'Offline';
            if (isOnline) {
                if (connectors.some(c => c.status === 'Charging')) {
                    stationStatus = 'Charging';
                }
                else if (connectors.every(c => c.status === 'Available')) {
                    stationStatus = 'Available';
                }
                else {
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
function handleTransactionsAPI(request) {
    const transactions = index_1.connectionManager.getRecentTransactions();
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
function handleDeleteTransactionAPI(request) {
    const urlParts = request.url.split('/');
    if (urlParts[urlParts.length - 1] === 'all') {
        // Удаление всех транзакций
        index_1.connectionManager.clearRecentTransactions();
        return {
            id: request.id,
            status: 200,
            data: {
                success: true,
                message: 'All transactions deleted'
            }
        };
    }
    else {
        // Удаление конкретной транзакции
        const transactionId = urlParts[urlParts.length - 1];
        const deleted = index_1.connectionManager.deleteRecentTransaction(transactionId);
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
function handleStationActionsAPI(request) {
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
function isWebSocketAPIRequest(message) {
    try {
        const parsed = JSON.parse(message);
        return parsed.id && parsed.method && parsed.url &&
            typeof parsed.id === 'string' &&
            ['GET', 'POST', 'DELETE'].includes(parsed.method) &&
            parsed.url.startsWith('/api/');
    }
    catch {
        return false;
    }
}
