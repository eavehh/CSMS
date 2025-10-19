"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserStations = getUserStations;
exports.getUserConnectorStatus = getUserConnectorStatus;
exports.userStartCharging = userStartCharging;
exports.userStopCharging = userStopCharging;
exports.getUserSessions = getUserSessions;
exports.getStatusNotification = getStatusNotification;
const index_1 = require("../../server/index");
const logger_1 = require("../../logger");
const httpHandlers_1 = require("../httpHandlers");
const remoteControl_1 = require("../../server/remoteControl");
const formatters_1 = require("../formatters");
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}
/**
 * GET /api/user/stations
 * Возвращает список доступных станций для зарядки
 * Только онлайн станции с доступными коннекторами
 */
function getUserStations(req, res) {
    (async () => {
        try {
            const activeStations = Array.from(index_1.connectionManager.getAllConnections()?.keys() || []);
            const stationsMap = index_1.connectionManager.getAllChargePointsWithConnectors();
            // Фильтруем только онлайн станции
            const data = Array.from(stationsMap.entries())
                .filter(([stationId]) => activeStations.includes(stationId))
                .map(([stationId, connectors]) => {
                const formatted = (0, formatters_1.formatStation)(stationId, connectors);
                // Фильтруем коннектор 0 (это станция, а не коннектор) и оставляем только доступные
                formatted.connectors = formatted.connectors
                    .filter(c => c.id > 0) // Исключаем connector 0 (станция)
                    .filter(c => c.status === 'Available' || c.status === 'Charging');
                return formatted;
            })
                .filter(station => station.connectors.length > 0); // Только станции с доступными коннекторами
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                data,
                count: data.length
            });
            logger_1.logger.info(`[USER_API] GET /api/user/stations - returned ${data.length} available stations`);
        }
        catch (err) {
            logger_1.logger.error(`[USER_API] getUserStations error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to fetch stations' });
        }
    })();
}
/**
 * GET /api/user/connector-status/:stationId/:connectorId
 * Возвращает статус конкретного коннектора
 */
function getUserConnectorStatus(req, res) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const parts = url.pathname.split('/');
            const stationId = parts[4];
            const connectorId = parseInt(parts[5]);
            if (!stationId || !connectorId || connectorId <= 0) {
                (0, httpHandlers_1.sendJson)(res, 400, { success: false, error: 'Invalid stationId or connectorId (must be > 0)' });
                return;
            }
            const state = index_1.connectionManager.getConnectorState(stationId, connectorId);
            if (!state) {
                (0, httpHandlers_1.sendJson)(res, 404, { success: false, error: 'Connector not found' });
                return;
            }
            const isOnline = index_1.connectionManager.get(stationId) !== undefined;
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                data: {
                    stationId,
                    connectorId,
                    status: state.status,
                    isOnline,
                    transactionId: state.transactionId || null,
                    lastUpdate: state.lastUpdate,
                    canCharge: state.status === 'Available' && isOnline
                }
            });
            logger_1.logger.info(`[USER_API] GET /api/user/connector-status/${stationId}/${connectorId} - status: ${state.status}`);
        }
        catch (err) {
            logger_1.logger.error(`[USER_API] getUserConnectorStatus error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to fetch connector status' });
        }
    })();
}
/**
 * POST /api/user/start-charging
 * Упрощенный старт зарядки для пользователя
 * body: { stationId, connectorId, userId }
 */
function userStartCharging(req, res) {
    (async () => {
        try {
            const body = await readBody(req);
            const { stationId, connectorId, userId } = body;
            if (!stationId || !connectorId || !userId || connectorId <= 0) {
                (0, httpHandlers_1.sendJson)(res, 400, { success: false, error: 'Missing required fields or invalid connectorId (must be > 0)' });
                return;
            }
            // Проверяем, что станция онлайн
            const ws = index_1.connectionManager.get(stationId);
            if (!ws) {
                (0, httpHandlers_1.sendJson)(res, 503, {
                    success: false,
                    error: 'Station is offline',
                    message: 'Пожалуйста, выберите другую станцию'
                });
                return;
            }
            // Проверяем статус коннектора
            const state = index_1.connectionManager.getConnectorState(stationId, connectorId);
            if (!state || state.status !== 'Available') {
                (0, httpHandlers_1.sendJson)(res, 400, {
                    success: false,
                    error: 'Connector not available',
                    message: 'Коннектор занят или недоступен'
                });
                return;
            }
            // Отправляем RemoteStartTransaction
            (0, remoteControl_1.sendRemoteStartTransaction)(index_1.connectionManager, stationId, {
                idTag: userId,
                connectorId,
                startValue: 0
            });
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                message: 'Зарядка начата',
                data: {
                    stationId,
                    connectorId,
                    userId,
                    startedAt: new Date().toISOString()
                }
            });
            logger_1.logger.info(`[USER_API] POST /api/user/start-charging - started for ${userId} on ${stationId}:${connectorId}`);
        }
        catch (err) {
            logger_1.logger.error(`[USER_API] userStartCharging error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to start charging' });
        }
    })();
}
/**
 * POST /api/user/stop-charging
 * Остановка зарядки для пользователя
 * body: { stationId, connectorId, userId, transactionId }
 */
function userStopCharging(req, res) {
    (async () => {
        try {
            const body = await readBody(req);
            const { stationId, connectorId, userId, transactionId } = body;
            if (!stationId || !connectorId || !userId || !transactionId || connectorId <= 0) {
                (0, httpHandlers_1.sendJson)(res, 400, { success: false, error: 'Missing required fields or invalid connectorId (must be > 0)' });
                return;
            }
            // Проверяем, что станция онлайн
            const ws = index_1.connectionManager.get(stationId);
            if (!ws) {
                (0, httpHandlers_1.sendJson)(res, 503, {
                    success: false,
                    error: 'Station is offline',
                    message: 'Станция недоступна'
                });
                return;
            }
            // Отправляем RemoteStopTransaction
            (0, remoteControl_1.sendRemoteStopTransaction)(index_1.connectionManager, stationId, {
                connectorId,
                transactionId
            });
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                message: 'Зарядка остановлена',
                data: {
                    stationId,
                    connectorId,
                    userId,
                    transactionId,
                    stoppedAt: new Date().toISOString()
                }
            });
            logger_1.logger.info(`[USER_API] POST /api/user/stop-charging - stopped for ${userId} on ${stationId}:${connectorId}`);
        }
        catch (err) {
            logger_1.logger.error(`[USER_API] userStopCharging error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to stop charging' });
        }
    })();
}
/**
 * GET /api/user/my-sessions
 * Возвращает активные сессии пользователя
 * query: userId
 */
function getUserSessions(req, res) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const userId = url.searchParams.get('userId');
            if (!userId) {
                (0, httpHandlers_1.sendJson)(res, 400, { success: false, error: 'Missing userId parameter' });
                return;
            }
            // Получаем все станции и их коннекторы
            const stationsMap = index_1.connectionManager.getAllChargePointsWithConnectors();
            const activeSessions = [];
            stationsMap.forEach((connectors, stationId) => {
                connectors.forEach((state, connectorId) => {
                    // Исключаем connector 0 и учитываем только зарядные коннекторы
                    if (connectorId > 0 && state.status === 'Charging' && state.transactionId) {
                        activeSessions.push({
                            stationId,
                            connectorId,
                            transactionId: state.transactionId,
                            status: state.status,
                            startedAt: state.lastUpdate
                        });
                    }
                });
            });
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                data: activeSessions,
                count: activeSessions.length
            });
            logger_1.logger.info(`[USER_API] GET /api/user/my-sessions - returned ${activeSessions.length} sessions for ${userId}`);
        }
        catch (err) {
            logger_1.logger.error(`[USER_API] getUserSessions error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to fetch sessions' });
        }
    })();
}
/**
 * GET /api/status/:stationId/:connectorId
 * Возвращает последний статус коннектора (StatusNotification)
 */
function getStatusNotification(req, res) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const parts = url.pathname.split('/');
            const stationId = parts[3];
            const connectorId = parseInt(parts[4]);
            if (!stationId || !connectorId || connectorId < 0) {
                (0, httpHandlers_1.sendJson)(res, 400, { success: false, error: 'Invalid stationId or connectorId' });
                return;
            }
            const state = index_1.connectionManager.getConnectorState(stationId, connectorId);
            if (!state) {
                (0, httpHandlers_1.sendJson)(res, 404, { success: false, error: 'Connector not found' });
                return;
            }
            const isOnline = index_1.connectionManager.get(stationId) !== undefined;
            (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                data: {
                    stationId,
                    connectorId,
                    status: state.status,
                    errorCode: state.errorCode || 'NoError',
                    isOnline,
                    lastUpdate: state.lastUpdate,
                    transactionId: state.transactionId || null,
                    isStationConnector: connectorId === 0 // Указываем, является ли это коннектором станции
                }
            });
            logger_1.logger.info(`[STATUS_API] GET /api/status/${stationId}/${connectorId} - status: ${state.status}, isStation: ${connectorId === 0}`);
        }
        catch (err) {
            logger_1.logger.error(`[STATUS_API] getStatusNotification error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Failed to fetch status' });
        }
    })();
}
