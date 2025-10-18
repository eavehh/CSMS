"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendJson = sendJson;
exports.handleHttpRequest = handleHttpRequest;
const url_1 = require("url");
const logger_1 = require("../logger");
const index_1 = require("../server/index");
const remoteControl_1 = require("../server/remoteControl");
const startTransaction_1 = require("../server/handlers/startTransaction");
const formatters_1 = require("./formatters");
const node_fetch_1 = __importDefault(require("node-fetch")); // npm install node-fetch
const postgres_1 = require("../db/postgres");
const Transaction_1 = require("../db/entities/Transaction");
const STATION_URL = 'http://localhost:3000'; // адрес вашей станции
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    logger_1.logger.info(`[httpHandlers] Access-Control allow methods : GET, POST; allow headers Content-Type, Authorization`);
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        logger_1.logger.info(`[httpHandlers], request method OPTIONS`);
        return;
    }
    // WS-эндпоинт (ваш существующий)
    if (req.method === 'GET' && req.url?.startsWith('/ocpp')) {
        logger_1.logger.info(`[httpHandlers], request method GET on "/ocpp", delegated to [WsServer]`);
        return; // Делегируем WsServer
    }
    const parsedUrl = new url_1.URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.searchParams;
    if (req.method === 'GET' && req.url?.startsWith('/api/transactions')) {
        (async () => {
            try {
                const repo = postgres_1.AppDataSource.getRepository(Transaction_1.Transaction);
                // Можно добавить фильтры по query-параметрам, если нужно
                const transactions = await repo.find({
                    order: { startTime: 'DESC' },
                    take: 100 // лимит на выдачу, если нужно
                });
                sendJson(res, 200, { success: true, data: transactions });
            }
            catch (err) {
                logger_1.logger.error(`[API] /api/transactions error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Internal server error' });
            }
        })();
        return;
    }
    if (req.method === 'POST' && pathname === '/api/start-station') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId } = JSON.parse(body);
                const response = await (0, node_fetch_1.default)(`${STATION_URL}/start-station`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chargePointId })
                });
                const data = await response.json();
                sendJson(res, 200, { success: true, message: data.message });
            }
            catch (err) {
                logger_1.logger.error(`[API] start-station Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Station start error' });
            }
        });
        return;
    }
    if (req.method === 'POST' && pathname === '/api/stop-station') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const response = await (0, node_fetch_1.default)(`${STATION_URL}/stop-station`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                sendJson(res, 200, { success: true, message: data.message });
            }
            catch (err) {
                logger_1.logger.error(`[API] stop-station Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Station stop error' });
            }
        });
    }
    if (req.method === 'GET' && pathname === '/api/stations') {
        (async () => {
            try {
                // Получаем только активные станции
                const activeStations = Array.from(index_1.connectionManager.getAllConnections()?.keys() || []);
                const stationsMap = index_1.connectionManager.getAllChargePointsWithConnectors();
                // Формируем только онлайн станции
                const data = Array.from(stationsMap.entries())
                    .filter(([stationId]) => activeStations.includes(stationId))
                    .map(([stationId, connectors]) => (0, formatters_1.formatStation)(stationId, connectors));
                sendJson(res, 200, { success: true, data });
                logger_1.logger.info(`[httpHandlers] GET /api/stations response formatted (only active stations)`);
            }
            catch (err) {
                logger_1.logger.error(`[httpHandlers] Stations query error: ${err}`);
                sendJson(res, 400, {
                    success: false,
                    error: 'Missing required fields'
                });
            }
        })();
        return;
    }
    if (req.method === 'POST' && pathname === '/api/remote-start-session') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId, connectorId, idTag, startValue } = JSON.parse(body);
                if (!chargePointId || !connectorId || !idTag) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
                    return;
                }
                // Отправляем RemoteStartTransaction по WS к станции
                (0, remoteControl_1.sendRemoteStartTransaction)(index_1.connectionManager, chargePointId, {
                    idTag,
                    connectorId,
                    startValue: startValue || 0
                });
                logger_1.logger.info(`[API] RemoteStartTransaction sent for ${chargePointId}, connector ${connectorId}`);
                sendJson(res, 200, { success: true, message: 'RemoteStartTransaction sent' });
            }
            catch (err) {
                logger_1.logger.error(`[API] remote-start-session Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Remote start session error' });
            }
        });
        return;
    }
    // REMOTE STOP TRANSACTION (для фронта)
    if (req.method === 'POST' && pathname === '/api/remote-stop-session') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId, connectorId, transactionId } = JSON.parse(body);
                if (!chargePointId || !connectorId || !transactionId) {
                    sendJson(res, 200, { success: true, message: 'No action taken, missing required fields' });
                    return;
                }
                // Отправляем RemoteStopTransaction по WS к станции
                const { sendRemoteStopTransaction } = require('./remoteControl');
                sendRemoteStopTransaction(index_1.connectionManager, chargePointId, {
                    connectorId,
                    transactionId
                });
                logger_1.logger.info(`[API] RemoteStopTransaction sent for ${chargePointId}, connector ${connectorId}, tx ${transactionId}`);
                sendJson(res, 200, { success: true, message: 'RemoteStopTransaction sent' });
            }
            catch (err) {
                logger_1.logger.error(`[API] remote-stop-session Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Remote stop session error' });
            }
        });
        return;
    }
    // В createServer callback
    if (req.method === 'POST' && pathname === '/api/start-session') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId, connectorId, idTag, limitType, limitValue, tariffPerKWh } = JSON.parse(body);
                if (!chargePointId || !connectorId || !idTag) {
                    sendJson(res, 400, { success: false, error: 'Missing required fields' });
                    return;
                }
                // Создаём payload для StartTransaction (имитируем req)
                const startPayload = {
                    connectorId,
                    idTag,
                    meterStart: 0,
                    timestamp: new Date().toISOString(),
                    limitType, // Кастомное поле (не в OCPP, но для внутренней логики)
                    limitValue,
                    tariffPerKWh: tariffPerKWh || 0.1
                };
                // Вызов логики StartTransaction (создаёт Transaction и Session)
                const response = await (0, startTransaction_1.handleStartTransaction)(startPayload, chargePointId, null); // ws=null, поскольку HTTP
                if (response.idTagInfo.status === 'Accepted') {
                    // Отправляем RemoteStartTransaction по WS к станции
                    (0, remoteControl_1.sendRemoteStartTransaction)(index_1.connectionManager, chargePointId, {
                        idTag,
                        connectorId,
                        startValue: 0 // meterStart
                    });
                    logger_1.logger.info(`[API] Start-session initiated for ${chargePointId}, connector ${connectorId}, limits: type=${limitType}, value=${limitValue}`);
                    sendJson(res, 200, { success: true, message: 'Session started', transactionId: response.transactionId });
                }
                else {
                    sendJson(res, 400, { success: false, error: 'Start rejected' });
                }
            }
            catch (err) {
                logger_1.logger.error(`[API] start-session Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Start session error' });
            }
        });
        return;
    }
    if (req.method === 'POST' && pathname === '/api/stop-session') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { transactionId, chargePointId, connectorId, idTag, meterStop, timestamp, reason } = JSON.parse(body);
                logger_1.logger.info(`[API] stop-session received: transactionId=${transactionId}, type=${typeof transactionId}`);
                if (!transactionId || !chargePointId || !connectorId || !idTag) {
                    sendJson(res, 400, { success: false, error: 'Missing required fields' });
                    return;
                }
                // Формируем payload для StopTransaction
                logger_1.logger.info(`[API] stop-session using transactionId as string: ${transactionId}, type=${typeof transactionId}`);
                const stopPayload = {
                    transactionId: parseInt(transactionId), // StopTransactionRequest ожидает number
                    idTag,
                    meterStop: meterStop || 0,
                    timestamp: timestamp || new Date().toISOString(),
                    reason: reason || 'Local'
                };
                // Вызов логики StopTransaction
                const { handleStopTransaction } = require('./handlers/stopTransaction');
                const response = await handleStopTransaction(stopPayload, chargePointId, null);
                if (response.idTagInfo.status === 'Accepted') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                }
                else {
                    sendJson(res, 400, { success: false, error: 'Stop rejected' });
                }
            }
            catch (err) {
                logger_1.logger.error(`[API] stop-session Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Stop session error' });
            }
        });
        return;
    }
    sendJson(res, 404, {
        success: false,
        error: 'API endpoint not found',
        info: 'CSMS WebSocket endpoint: ws://localhost:8081/ocpp'
    });
    // Дефолтный обработчик
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}/ocpp\n`);
}
