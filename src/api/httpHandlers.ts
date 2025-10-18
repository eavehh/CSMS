import { get, IncomingMessage, ServerResponse } from 'http';
import { StartTransactionRequest } from '../server/types/1.6/StartTransaction'
import { URL, URLSearchParams } from 'url';
import { logger } from '../logger';
import { connectionManager } from '../server/index';
import { handleStartTransaction } from '../server/handlers/startTransaction';
import { sendRemoteStartTransaction } from '../server/remoteControl';
import { getStations, startStationsApiHandler, stopStationsApiHandler } from './apiHandlers/stationsApi'
import { transactionsApiHandler, startRemoteTrx, stopRemoteTrx, clearRecentTransactionsHandler } from "./apiHandlers/transactionsApi";
import {
    getUserStations,
    getUserConnectorStatus,
    userStartCharging,
    userStopCharging,
    getUserSessions,
    getStatusNotification
} from './apiHandlers/userApi';


export const STATION_URL = 'http://localhost:3000'; // адрес вашей станции

const PORT = 8081;  // Импорт из index, если нужно

/*
 * Универсальная функция для отправки JSON-ответа
 */

export function sendJson(
    res: ServerResponse,
    status: number,
    payload: any
) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

// ...existing code...
export function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
    // CORS для фронтенда
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    logger.info(`[httpHandlers] Access-Control allow methods : GET, POST; allow headers Content-Type, Authorization`)

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // ======== PUBLIC REST API ========
    // GET /api/stations - список активных (онлайн) станций (готовый для фронта формат)
    if (req.method === 'GET' && pathname === '/api/stations') {
        getStations(req, res);
        return;
    }

    // GET /api/transactions - история транзакций (Postgres) / query: ?chargePointId=...
    if (req.method === 'GET' && pathname === '/api/transactions') {
        transactionsApiHandler(req, res);
        return;
    }

    // POST /api/transactions/clear - очистка старых транзакций в БД (админ)
    if (req.method === 'POST' && pathname === '/api/transactions/clear') {
        clearRecentTransactionsHandler(req, res);
        return;
    }

    // ======== ADMIN API (remote control) ========
    // POST /api/admin/remote-start-session - remote start (from admin panel / dart)
    if (req.method === 'POST' && pathname === '/api/admin/remote-start-session') {
        startRemoteTrx(req, res);
        return;
    }

    // POST /api/admin/remote-stop-session - remote stop (from admin panel / dart)
    if (req.method === 'POST' && pathname === '/api/admin/remote-stop-session') {
        stopRemoteTrx(req, res);
        return;
    }

    // ======== USER API ========
    if (req.method === 'GET' && pathname === '/api/user/stations') {
        getUserStations(req, res);
        return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/user/connector-status/')) {
        getUserConnectorStatus(req, res);
        return;
    }

    if (req.method === 'POST' && pathname === '/api/user/start-charging') {
        userStartCharging(req, res);
        return;
    }

    if (req.method === 'POST' && pathname === '/api/user/stop-charging') {
        userStopCharging(req, res);
        return;
    }

    if (req.method === 'GET' && pathname === '/api/user/my-sessions') {
        getUserSessions(req, res);
        return;
    }

    // STATUS notification
    if (req.method === 'GET' && pathname.startsWith('/api/status/')) {
        getStatusNotification(req, res);
        return;
    }

    // Fallback - API endpoint not found -> return JSON (avoid text/plain)
    sendJson(res, 404, {
        success: false,
        error: 'API endpoint not found',
        info: `CSMS WebSocket endpoint: ws://localhost:${PORT}/ocpp`
    });



    // Дефолтный обработчик
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}/ocpp\n`);


}