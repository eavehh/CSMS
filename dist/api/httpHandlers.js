"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATION_URL = void 0;
exports.sendJson = sendJson;
exports.handleHttpRequest = handleHttpRequest;
const url_1 = require("url");
const logger_1 = require("../logger");
const stationsApi_1 = require("./apiHandlers/stationsApi");
const transactionsApi_1 = require("./apiHandlers/transactionsApi");
const userApi_1 = require("./apiHandlers/userApi");
exports.STATION_URL = 'http://localhost:3000'; // адрес вашей станции
const PORT = 8081; // Импорт из index, если нужно
/*
 * Универсальная функция для отправки JSON-ответа
 */
function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}
function handleHttpRequest(req, res) {
    // CORS для фронтенда
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    logger_1.logger.info(`[httpHandlers] Access-Control allow methods : GET, POST; allow headers Content-Type, Authorization`);
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    const parsedUrl = new url_1.URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;
    // ======== PUBLIC REST API ========
    // GET /api/stations - список активных (онлайн) станций (готовый для фронта формат)
    if (req.method === 'GET' && pathname === '/api/stations') {
        (0, stationsApi_1.getStations)(req, res);
        return;
    }
    // GET /api/transactions/recent - последние 10 транзакций из памяти (с start и stop данными)
    if (req.method === 'GET' && pathname === '/api/transactions/recent') {
        (0, transactionsApi_1.recentTransactionsApiHandler)(req, res);
        return;
    }
    // DELETE /api/transactions/recent - очистить недавние транзакции из памяти (админ)
    if (req.method === 'DELETE' && pathname === '/api/transactions/recent') {
        (0, transactionsApi_1.clearRecentTransactionsMemoryHandler)(req, res);
        return;
    }
    // GET /api/transactions - история транзакций (Postgres) / query: ?chargePointId=...
    if (req.method === 'GET' && pathname === '/api/transactions') {
        (0, transactionsApi_1.transactionsApiHandler)(req, res);
        return;
    }
    // POST /api/transactions/clear - очистка старых транзакций в БД (админ)
    if (req.method === 'POST' && pathname === '/api/transactions/clear') {
        (0, transactionsApi_1.clearRecentTransactionsHandler)(req, res);
        return;
    }
    // ======== ADMIN API (remote control) ========
    // POST /api/admin/remote-start-session - remote start (from admin panel / dart)
    if (req.method === 'POST' && pathname === '/api/admin/remote-start-session') {
        (0, transactionsApi_1.startRemoteTrx)(req, res);
        return;
    }
    // POST /api/admin/remote-stop-session - remote stop (from admin panel / dart)
    if (req.method === 'POST' && pathname === '/api/admin/remote-stop-session') {
        (0, transactionsApi_1.stopRemoteTrx)(req, res);
        return;
    }
    // ======== USER API ========
    if (req.method === 'GET' && pathname === '/api/user/stations') {
        (0, userApi_1.getUserStations)(req, res);
        return;
    }
    if (req.method === 'GET' && pathname.startsWith('/api/user/connector-status/')) {
        (0, userApi_1.getUserConnectorStatus)(req, res);
        return;
    }
    if (req.method === 'POST' && pathname === '/api/user/start-charging') {
        (0, userApi_1.userStartCharging)(req, res);
        return;
    }
    if (req.method === 'POST' && pathname === '/api/user/stop-charging') {
        (0, userApi_1.userStopCharging)(req, res);
        return;
    }
    if (req.method === 'GET' && pathname === '/api/user/my-sessions') {
        (0, userApi_1.getUserSessions)(req, res);
        return;
    }
    // STATUS notification
    if (req.method === 'GET' && pathname.startsWith('/api/status/')) {
        (0, userApi_1.getStatusNotification)(req, res);
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
