import WebSocket from 'ws';
import { logger } from '../logger';
import { connectionManager } from './index';
import { ApiKey } from '../db/mongoose';
import { sendRemoteStartTransaction, sendRemoteStopTransaction } from './remoteControl';
import { v4 as uuidv4 } from 'uuid';
import { formatTransaction } from '../api/formatters';

// New action-based request envelope (coexists with legacy method/url style)
export interface ActionRequest {
    id: string;
    action: string;
    params?: any;
}

export interface ActionSuccessResponse {
    id: string;
    result: any;
}

export interface ActionErrorResponse {
    id: string;
    error: { code: number; message: string; correlationId?: string };
}

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

export function handleWebSocketAPI(ws: WebSocket, raw: any): void {
    // Detect action-based vs legacy
    if (isActionRequest(raw)) {
        const req: ActionRequest = raw;
        logger.info(`[WS-API:ACTION] ${req.action} (id: ${req.id})`);
        handleActionRequest(ws, req);
        return;
    }

    const request: WebSocketAPIRequest = raw;
    logger.info(`[WS-API:LEGACY] ${request.method} ${request.url} (id: ${request.id})`);

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
                    response = { id: request.id, status: 404, error: 'Endpoint not found' };
                }
        }
    } catch (error) {
        logger.error(`[WS-API] Error handling ${request.url}: ${error}`);
        response = { id: request.id, status: 500, error: 'Internal server error' };
    }

    ws.send(JSON.stringify(response));
    logger.info(`[WS-API:LEGACY] Response sent for ${request.id}: ${response.status}`);
}

function isActionRequest(obj: any): obj is ActionRequest {
    return obj && typeof obj === 'object' && typeof obj.id === 'string' && typeof obj.action === 'string';
}

function handleActionRequest(ws: WebSocket, req: ActionRequest) {
    try {
        switch (req.action) {
            case 'auth':
                return handleAuth(ws, req);
            case 'ping':
                return sendAction(ws, { id: req.id, result: { pong: true, ts: Date.now() } });
            case 'getStations':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: mapStations() });
            case 'getRecentTransactions':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: mapRecentTransactions() });
            case 'startCharging':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return handleStartCharging(ws, req);
            case 'stopCharging':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return handleStopCharging(ws, req);
            case 'getConnectorStatus':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: getConnectorStatus(req.params) });
            case 'getMySessions':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: mapRecentTransactions() });
            case 'getMeterValuesRecent':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: getMeterValuesRecent(req.params) });
            case 'subscribe':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: subscribe(ws, req.params) });
            case 'unsubscribe':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: unsubscribe(ws, req.params) });
            case 'deleteTransaction':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: deleteTransaction(req.params) });
            case 'deleteTransactionsAll':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: deleteTransactionsAll() });
            case 'getEventsRecent':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return sendAction(ws, { id: req.id, result: getEventsRecent(req.params) });
            case 'getEventsSince':
                if (!isAuthed(ws)) return notAuthed(ws, req.id);
                return handleGetEventsSince(ws, req);
            default:
                return sendAction(ws, { id: req.id, error: { code: 400, message: 'Unknown action' } });
        }
    } catch (err: any) {
        logger.error(`[WS-API:ACTION] Error in ${req.action}: ${err?.message || err}`);
        return sendAction(ws, { id: req.id, error: { code: 500, message: 'Internal error' } });
    }
}

function handleAuth(ws: WebSocket, req: ActionRequest) {
    const providedKey = req.params?.apiKey;
    if (!providedKey) {
        return sendAction(ws, { id: req.id, error: { code: 400, message: 'apiKey required' } });
    }
    ApiKey.findOne({ key: providedKey, active: true }).then(doc => {
        if (!doc) {
            return sendAction(ws, { id: req.id, error: { code: 401, message: 'Invalid apiKey' } });
        }
        (ws as any).auth = { apiKey: providedKey, scopes: doc.scopes || [], authenticatedAt: Date.now() };
        return sendAction(ws, { id: req.id, result: { status: 'ok', sessionId: `sess-${Date.now()}`, scopes: doc.scopes || [] } });
    }).catch(err => {
        logger.error(`[WS-API:AUTH] DB error: ${err}`);
        return sendAction(ws, { id: req.id, error: { code: 500, message: 'auth internal error' } });
    });
}

function sendAction(ws: WebSocket, payload: ActionSuccessResponse | ActionErrorResponse) {
    ws.send(JSON.stringify(payload));
    if ('error' in payload) {
        logger.info(`[WS-API:ACTION] Error response ${payload.id}: ${payload.error.code} ${payload.error.message}`);
    } else {
        logger.info(`[WS-API:ACTION] Success response ${payload.id}`);
    }
}

function isAuthed(ws: WebSocket): boolean {
    const auth = (ws as any).auth;
    if (!auth) return false;
    const maxAge = Number(process.env.WS_SESSION_MAX_AGE_MS || 24 * 60 * 60 * 1000); // default 24h
    if (Date.now() - auth.authenticatedAt > maxAge) {
        // Expire session
        delete (ws as any).auth;
        try { ws.send(JSON.stringify({ event: 'session.expired', ts: Date.now() })); } catch { }
        logger.info('[WS-API:SESSION] Session expired');
        return false;
    }
    return true;
}

function notAuthed(ws: WebSocket, id: string) {
    return sendAction(ws, { id, error: { code: 401, message: 'Not authenticated' } });
}

function handleStationsAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    return { id: request.id, status: 200, data: { success: true, data: mapStations() } };
}

function handleTransactionsAPI(request: WebSocketAPIRequest): WebSocketAPIResponse {
    const transactions = mapRecentTransactions();
    return { id: request.id, status: 200, data: { success: true, data: transactions, count: transactions.length } };
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

// Shared mapping helpers
function mapStations() {
    const connections = connectionManager.getAllConnections();
    const allConnectors = connectionManager.getAllChargePointsWithConnectors();
    const stations: any[] = [];
    if (connections) {
        connections.forEach((wsConnection, chargePointId) => {
            if (chargePointId === 'mobile-client' || chargePointId === 'unknown') return;
            const lastActivity = connectionManager.lastActivity.get(chargePointId);
            const isOnline = wsConnection.readyState === WebSocket.OPEN;
            const connectorsMap = allConnectors.get(chargePointId);
            const connectors: any[] = [];
            if (connectorsMap && connectorsMap.size > 0) {
                connectorsMap.forEach((state, connectorId) => {
                    connectors.push({
                        id: connectorId,
                        status: state.status || 'Unknown',
                        transactionId: state.transactionId || null,
                        errorCode: state.errorCode || null,
                        updatedAt: state.lastUpdate ? state.lastUpdate.toISOString() : new Date().toISOString()
                    });
                });
            }
            let stationStatus = 'Offline';
            if (isOnline) {
                if (connectors.some(c => c.status === 'Charging')) stationStatus = 'Charging';
                else if (connectors.every(c => c.status === 'Available')) stationStatus = 'Available';
                else stationStatus = 'PartiallyAvailable';
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
    return stations;
}

function mapRecentTransactions() {
    const transactions = connectionManager.getRecentTransactions();
    return transactions.map(tx => formatTransaction(tx));
}

function mockStart(params: any) {
    return { message: `Start command accepted for ${params?.stationId}`, transactionId: Math.floor(Math.random() * 1e6) };
}

function mockStop(params: any) {
    return { message: `Stop command accepted for ${params?.stationId}` };
}

// Correlation store (in-memory): remoteStartCorrelationId -> { stationId, connectorId, requestedAt }
const remoteStartCorrelations: Map<string, { stationId: string; connectorId: number; requestedAt: number }> = new Map();

export function getRemoteStartCorrelation(correlationId: string) {
    return remoteStartCorrelations.get(correlationId);
}

export function resolveRemoteStartCorrelation(stationId: string, connectorId: number, transactionId: string) {
    // Find correlation entries matching station+connector without transaction yet
    for (const [corrId, info] of remoteStartCorrelations.entries()) {
        if (info.stationId === stationId && info.connectorId === connectorId) {
            // Attach transactionId by broadcasting enriched event (done in StartTransaction handler)
            remoteStartCorrelations.delete(corrId);
            return corrId;
        }
    }
    return undefined;
}

async function handleStartCharging(ws: WebSocket, req: ActionRequest) {
    const stationId = req.params?.stationId;
    const connectorId = req.params?.connectorId || 1;
    const idTag = req.params?.idTag || 'TEST';
    if (!stationId) return sendAction(ws, { id: req.id, error: { code: 400, message: 'stationId required' } });

    // Send OCPP RemoteStartTransaction with correlationId tracking
    const correlationId = `corr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    remoteStartCorrelations.set(correlationId, { stationId, connectorId, requestedAt: Date.now() });
    sendRemoteStartTransaction(connectionManager, stationId, { idTag, connectorId });

    // Correlate response: pending request already tracked in messageRouter via uniqueId.
    // We will poll for a short period for an Accepted response reflected in connector state.
    const startTs = Date.now();
    const timeoutMs = Number(process.env.REMOTE_START_TIMEOUT_MS || 5000);
    const pollInterval = 250;
    let accepted = false;
    while (Date.now() - startTs < timeoutMs) {
        const state = connectionManager.getConnectorState(stationId, connectorId);
        if (state && state.status === 'Charging') {
            accepted = true;
            break;
        }
        await sleep(pollInterval);
    }
    if (accepted) {
        connectionManager.broadcastEvent('remote.start.result', { stationId, connectorId, idTag, status: 'Accepted', correlationId });
        return sendAction(ws, { id: req.id, result: { status: 'Accepted', stationId, connectorId, correlationId } });
    } else {
        connectionManager.broadcastEvent('remote.start.result', { stationId, connectorId, idTag, status: 'PendingTimeout', correlationId });
        return sendAction(ws, { id: req.id, error: { code: 504, message: 'RemoteStart timeout or not reflected', correlationId } });
    }
}

async function handleStopCharging(ws: WebSocket, req: ActionRequest) {
    const stationId = req.params?.stationId;
    const connectorId = req.params?.connectorId || 1;
    const transactionId = req.params?.transactionId;
    if (!stationId) return sendAction(ws, { id: req.id, error: { code: 400, message: 'stationId required' } });
    if (!transactionId) return sendAction(ws, { id: req.id, error: { code: 400, message: 'transactionId required' } });

    sendRemoteStopTransaction(connectionManager, stationId, { transactionId });

    const startTs = Date.now();
    const timeoutMs = Number(process.env.REMOTE_STOP_TIMEOUT_MS || 5000);
    const pollInterval = 250;
    let stopped = false;
    while (Date.now() - startTs < timeoutMs) {
        const state = connectionManager.getConnectorState(stationId, connectorId);
        if (state && state.status !== 'Charging') {
            stopped = true;
            break;
        }
        await sleep(pollInterval);
    }
    if (stopped) {
        connectionManager.broadcastEvent('remote.stop.result', { stationId, connectorId, transactionId, status: 'Accepted' });
        return sendAction(ws, { id: req.id, result: { status: 'Accepted', stationId, connectorId, transactionId } });
    } else {
        connectionManager.broadcastEvent('remote.stop.result', { stationId, connectorId, transactionId, status: 'PendingTimeout' });
        return sendAction(ws, { id: req.id, error: { code: 504, message: 'RemoteStop timeout or not reflected' } });
    }
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function getConnectorStatus(params: any) {
    const { stationId, connectorId } = params || {};
    if (!stationId || !connectorId) return { error: 'Missing stationId or connectorId' };
    const state = connectionManager.getConnectorState(stationId, Number(connectorId));
    if (!state) return { stationId, connectorId, status: 'Unknown' };
    return {
        stationId,
        connectorId: Number(connectorId),
        status: state.status,
        transactionId: state.transactionId || null,
        errorCode: state.errorCode || null,
        lastUpdate: state.lastUpdate.toISOString()
    };
}

function getMeterValuesRecent(params: any) {
    const stationId = params?.stationId;
    if (!stationId) return { error: 'stationId required' };
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const samples = connectionManager.getRecentMeterValues(stationId, limit);
    return samples.map(s => ({
        stationId,
        connectorId: s.connectorId,
        transactionId: s.transactionId,
        timestamp: s.timestamp.toISOString(),
        sampledValue: s.sampledValue
    }));
}

function subscribe(ws: WebSocket, params: any) {
    const stationId = params?.stationId;
    const events = Array.isArray(params?.events) ? params.events : undefined;
    const subscriptionId = connectionManager.addSubscription(ws, stationId, events);
    const snapshot: any = {};
    if (stationId) {
        snapshot.stations = mapStations().filter(s => s.id === stationId);
    } else {
        snapshot.stations = mapStations();
    }
    return { subscriptionId, snapshot };
}

function unsubscribe(ws: WebSocket, params: any) {
    const subscriptionId = params?.subscriptionId;
    if (!subscriptionId) return { error: 'subscriptionId required' };
    const removed = connectionManager.removeSubscription(ws, subscriptionId);
    return { subscriptionId, removed };
}

function deleteTransaction(params: any) {
    const id = params?.transactionId;
    if (!id) return { error: 'transactionId required' };
    const removed = connectionManager.deleteRecentTransaction(id);
    return { transactionId: id, removed };
}

function deleteTransactionsAll() {
    const countBefore = connectionManager.getRecentTransactions().length;
    connectionManager.clearRecentTransactions();
    return { cleared: countBefore };
}

function getEventsRecent(params: any) {
    const limit = typeof params?.limit === 'number' ? params.limit : 50;
    return connectionManager.getRecentEvents(limit);
}

async function handleGetEventsSince(ws: WebSocket, req: ActionRequest) {
    const { eventId, ts, limit } = req.params || {};
    const maxLimit = Number(process.env.EVENTS_REPLAY_MAX_LIMIT || 500);
    const finalLimit = typeof limit === 'number' ? limit : maxLimit;
    if (finalLimit > maxLimit) {
        return sendAction(ws, { id: req.id, error: { code: 400, message: 'limit too large' } });
    }
    if (!eventId && !ts) {
        return sendAction(ws, { id: req.id, error: { code: 400, message: 'eventId or ts required' } });
    }
    try {
        const { Event } = require('../db/mongoose');
        const query: any = {};
        if (eventId) {
            // Extract numeric epoch from eventId pattern evt-<epoch>-rand
            const parts = String(eventId).split('-');
            if (parts.length >= 3) {
                const epoch = Number(parts[1]);
                if (!Number.isNaN(epoch)) {
                    query.ts = { $gt: epoch };
                }
            }
        } else if (ts) {
            query.ts = { $gt: Number(ts) };
        }
        const events = await Event.find(query).sort({ ts: 1 }).limit(finalLimit).lean();
        const result = {
            events: events,
            count: events.length,
            cursor: events.length ? { lastEventId: events[events.length - 1].eventId } : null
        };
        return sendAction(ws, { id: req.id, result });
    } catch (err: any) {
        logger.error(`[WS-API:getEventsSince] Error: ${err?.message || err}`);
        return sendAction(ws, { id: req.id, error: { code: 500, message: 'replay error' } });
    }
}

export function isWebSocketAPIRequest(message: string): boolean {
    try {
        const parsed = JSON.parse(message);
        // Accept either legacy or action-based
        const legacy = parsed.id && parsed.method && parsed.url && typeof parsed.id === 'string' && ['GET', 'POST', 'DELETE'].includes(parsed.method) && parsed.url.startsWith('/api/');
        const action = parsed.id && parsed.action && typeof parsed.action === 'string';
        return legacy || action;
    } catch {
        return false;
    }
}