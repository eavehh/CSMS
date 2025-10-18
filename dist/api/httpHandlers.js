"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATION_URL = void 0;
exports.sendJson = sendJson;
exports.handleHttpRequest = handleHttpRequest;
const url_1 = require("url");
const logger_1 = require("../logger");
const index_1 = require("../server/index");
const startTransaction_1 = require("../server/handlers/startTransaction");
const remoteControl_1 = require("../server/remoteControl");
const stationsApi_1 = require("./apiHandlers/stationsApi");
const transactionsApi_1 = require("./apiHandlers/transactionsApi");
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
        (0, transactionsApi_1.transactionsApiHandler)(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/stations') {
        (0, stationsApi_1.getStations)(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/start-station') {
        (0, stationsApi_1.startStationsApiHandler)(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/stop-station') {
        (0, stationsApi_1.stopStationsApiHandler)(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/remote-start-session') {
        (0, transactionsApi_1.startRemoteTrx)(req, res);
    }
    // REMOTE STOP TRANSACTION (для фронта)
    if (req.method === 'POST' && pathname === '/api/remote-stop-session') {
        (0, transactionsApi_1.stopRemoteTrx)(req, res);
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
