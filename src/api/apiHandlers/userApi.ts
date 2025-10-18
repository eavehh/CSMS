import { IncomingMessage, ServerResponse } from 'http';
import { connectionManager } from '../../server/index';
import { logger } from '../../logger';
import { sendJson } from '../httpHandlers';
import { sendRemoteStartTransaction, sendRemoteStopTransaction } from '../../server/remoteControl';
import { formatStation } from '../formatters';

function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
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
export function getUserStations(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const activeStations = Array.from(connectionManager.getAllConnections()?.keys() || []);
            const stationsMap = connectionManager.getAllChargePointsWithConnectors();

            // Фильтруем только онлайн станции
            const data = Array.from(stationsMap.entries())
                .filter(([stationId]) => activeStations.includes(stationId))
                .map(([stationId, connectors]) => {
                    const formatted = formatStation(stationId, connectors);
                    // Добавляем только доступные коннекторы для пользователя
                    formatted.connectors = formatted.connectors.filter(c => 
                        c.status === 'Available' || c.status === 'Charging'
                    );
                    return formatted;
                })
                .filter(station => station.connectors.length > 0); // Только станции с доступными коннекторами

            sendJson(res, 200, { 
                success: true, 
                data,
                count: data.length
            });
            logger.info(`[USER_API] GET /api/user/stations - returned ${data.length} available stations`);
        } catch (err) {
            logger.error(`[USER_API] getUserStations error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to fetch stations' });
        }
    })();
}

/**
 * GET /api/user/connector-status/:stationId/:connectorId
 * Возвращает статус конкретного коннектора
 */
export function getUserConnectorStatus(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const parts = url.pathname.split('/');
            const stationId = parts[4];
            const connectorId = parseInt(parts[5]);

            if (!stationId || !connectorId) {
                sendJson(res, 400, { success: false, error: 'Missing stationId or connectorId' });
                return;
            }

            const state = connectionManager.getConnectorState(stationId, connectorId);
            
            if (!state) {
                sendJson(res, 404, { success: false, error: 'Connector not found' });
                return;
            }

            const isOnline = connectionManager.get(stationId) !== undefined;

            sendJson(res, 200, {
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
            logger.info(`[USER_API] GET /api/user/connector-status/${stationId}/${connectorId} - status: ${state.status}`);
        } catch (err) {
            logger.error(`[USER_API] getUserConnectorStatus error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to fetch connector status' });
        }
    })();
}

/**
 * POST /api/user/start-charging
 * Упрощенный старт зарядки для пользователя
 * body: { stationId, connectorId, userId }
 */
export function userStartCharging(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const body = await readBody(req);
            const { stationId, connectorId, userId } = body;

            if (!stationId || !connectorId || !userId) {
                sendJson(res, 400, { success: false, error: 'Missing required fields: stationId, connectorId, userId' });
                return;
            }

            // Проверяем, что станция онлайн
            const ws = connectionManager.get(stationId);
            if (!ws) {
                sendJson(res, 503, { 
                    success: false, 
                    error: 'Station is offline',
                    message: 'Пожалуйста, выберите другую станцию'
                });
                return;
            }

            // Проверяем статус коннектора
            const state = connectionManager.getConnectorState(stationId, connectorId);
            if (!state || state.status !== 'Available') {
                sendJson(res, 400, { 
                    success: false, 
                    error: 'Connector not available',
                    message: 'Коннектор занят или недоступен'
                });
                return;
            }

            // Отправляем RemoteStartTransaction
            sendRemoteStartTransaction(connectionManager, stationId, {
                idTag: userId,
                connectorId,
                startValue: 0
            });

            sendJson(res, 200, { 
                success: true, 
                message: 'Зарядка начата',
                data: {
                    stationId,
                    connectorId,
                    userId,
                    startedAt: new Date().toISOString()
                }
            });
            logger.info(`[USER_API] POST /api/user/start-charging - started for ${userId} on ${stationId}:${connectorId}`);
        } catch (err) {
            logger.error(`[USER_API] userStartCharging error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to start charging' });
        }
    })();
}

/**
 * POST /api/user/stop-charging
 * Остановка зарядки для пользователя
 * body: { stationId, connectorId, userId, transactionId }
 */
export function userStopCharging(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const body = await readBody(req);
            const { stationId, connectorId, userId, transactionId } = body;

            if (!stationId || !connectorId || !userId || !transactionId) {
                sendJson(res, 400, { success: false, error: 'Missing required fields: stationId, connectorId, userId, transactionId' });
                return;
            }

            // Проверяем, что станция онлайн
            const ws = connectionManager.get(stationId);
            if (!ws) {
                sendJson(res, 503, { 
                    success: false, 
                    error: 'Station is offline',
                    message: 'Станция недоступна'
                });
                return;
            }

            // Отправляем RemoteStopTransaction
            sendRemoteStopTransaction(connectionManager, stationId, {
                connectorId,
                transactionId
            });

            sendJson(res, 200, { 
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
            logger.info(`[USER_API] POST /api/user/stop-charging - stopped for ${userId} on ${stationId}:${connectorId}`);
        } catch (err) {
            logger.error(`[USER_API] userStopCharging error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to stop charging' });
        }
    })();
}

/**
 * GET /api/user/my-sessions
 * Возвращает активные сессии пользователя
 * query: userId
 */
export function getUserSessions(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const userId = url.searchParams.get('userId');

            if (!userId) {
                sendJson(res, 400, { success: false, error: 'Missing userId parameter' });
                return;
            }

            // Получаем все станции и их коннекторы
            const stationsMap = connectionManager.getAllChargePointsWithConnectors();
            const activeSessions: any[] = [];

            stationsMap.forEach((connectors, stationId) => {
                connectors.forEach((state, connectorId) => {
                    if (state.status === 'Charging' && state.transactionId) {
                        // Здесь можно добавить проверку userId через transactionId
                        // Пока просто возвращаем все активные сессии
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

            sendJson(res, 200, { 
                success: true, 
                data: activeSessions,
                count: activeSessions.length
            });
            logger.info(`[USER_API] GET /api/user/my-sessions - returned ${activeSessions.length} sessions for ${userId}`);
        } catch (err) {
            logger.error(`[USER_API] getUserSessions error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to fetch sessions' });
        }
    })();
}

/**
 * GET /api/status/:stationId/:connectorId
 * Возвращает последний статус коннектора (StatusNotification)
 */
export function getStatusNotification(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const url = new URL(req.url || '', 'http://localhost:8081');
            const parts = url.pathname.split('/');
            const stationId = parts[3];
            const connectorId = parseInt(parts[4]);

            if (!stationId || !connectorId) {
                sendJson(res, 400, { success: false, error: 'Missing stationId or connectorId' });
                return;
            }

            const state = connectionManager.getConnectorState(stationId, connectorId);
            
            if (!state) {
                sendJson(res, 404, { success: false, error: 'Connector not found' });
                return;
            }

            const isOnline = connectionManager.get(stationId) !== undefined;

            sendJson(res, 200, {
                success: true,
                data: {
                    stationId,
                    connectorId,
                    status: state.status,
                    errorCode: state.errorCode || 'NoError',
                    isOnline,
                    lastUpdate: state.lastUpdate,
                    transactionId: state.transactionId || null
                }
            });
            logger.info(`[STATUS_API] GET /api/status/${stationId}/${connectorId} - status: ${state.status}`);
        } catch (err) {
            logger.error(`[STATUS_API] getStatusNotification error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Failed to fetch status' });
        }
    })();
}

