import { IncomingMessage, ServerResponse } from 'http';
import { StartTransactionRequest } from '../server/types/1.6/StartTransaction'
import { URL, URLSearchParams } from 'url';
import { logger } from '../logger';
import { connectionManager } from '../server/index';
import { sendReserveNow, sendRemoteStartTransaction } from '../server/remoteControl';
import { handleStartTransaction } from '../server/handlers/startTransaction';
import { formatConnector, formatStation } from './formatters'
import fetch from 'node-fetch'; // npm install node-fetch
import { AppDataSource } from '../db/postgres';
import { Transaction } from '../db/entities/Transaction';

const STATION_URL = 'http://localhost:3000'; // адрес вашей станции

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


export function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
    // CORS для фронтенда
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    logger.info(`[httpHandlers] Access-Control allow methods : GET, POST; allow headers Content-Type, Authorization`)

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        logger.info(`[httpHandlers], request method OPTIONS`)
        return;
    }


    // WS-эндпоинт (ваш существующий)
    if (req.method === 'GET' && req.url?.startsWith('/ocpp')) {
        logger.info(`[httpHandlers], request method GET on "/ocpp", delegated to [WsServer]`)
        return;  // Делегируем WsServer
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.searchParams;


    if (req.method === 'GET' && req.url?.startsWith('/api/transactions')) {
        (async () => {
            try {
                const repo = AppDataSource.getRepository(Transaction);
                // Можно добавить фильтры по query-параметрам, если нужно
                const transactions = await repo.find({
                    order: { startTime: 'DESC' },
                    take: 100 // лимит на выдачу, если нужно
                });
                sendJson(res, 200, { success: true, data: transactions });
            } catch (err) {
                logger.error(`[API] /api/transactions error: ${err}`);
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
                const response = await fetch(`${STATION_URL}/start-station`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chargePointId })
                });
                const data = await response.json();
                sendJson(res, 200, { success: true, message: (data as any).message });
            } catch (err) {
                logger.error(`[API] start-station Error: ${err}`);
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
                const response = await fetch(`${STATION_URL}/stop-station`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                sendJson(res, 200, { success: true, message: (data as any).message });
            } catch (err) {
                logger.error(`[API] stop-station Error: ${err}`);
                sendJson(res, 500, { success: false, error: 'Station stop error' });
            }
        });
    }



    if (req.method === 'GET' && pathname === '/api/stations') {
        (async () => {
            try {
                const stationsMap = await connectionManager.getAllChargePointsWithConnectors();

                // Преобразуем “сырые” данные в отформатированные
                const data = Array.from(stationsMap.entries()).map(([stationId, connectors]) =>
                    formatStation(stationId, connectors)
                );

                sendJson(res, 200, { success: true, data });

                logger.info(`[httpHandlers] GET /api/stations response formatted`);
            } catch (err) {
                logger.error(`[httpHandlers] Stations query error: ${err}`);
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
                sendRemoteStartTransaction(connectionManager, chargePointId, {
                    idTag,
                    connectorId,
                    startValue: startValue || 0
                });
                logger.info(`[API] RemoteStartTransaction sent for ${chargePointId}, connector ${connectorId}`);
                sendJson(res, 200, { success: true, message: 'RemoteStartTransaction sent' });

            } catch (err) {
                logger.error(`[API] remote-start-session Error: ${err}`);
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
                sendRemoteStopTransaction(connectionManager, chargePointId, {
                    connectorId,
                    transactionId
                });
                logger.info(`[API] RemoteStopTransaction sent for ${chargePointId}, connector ${connectorId}, tx ${transactionId}`);
                sendJson(res, 200, { success: true, message: 'RemoteStopTransaction sent' });
            } catch (err) {
                logger.error(`[API] remote-stop-session Error: ${err}`);
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
                    limitType,  // Кастомное поле (не в OCPP, но для внутренней логики)
                    limitValue,
                    tariffPerKWh: tariffPerKWh || 0.1
                };

                // Вызов логики StartTransaction (создаёт Transaction и Session)
                const response = await handleStartTransaction(startPayload as StartTransactionRequest, chargePointId, null as any);  // ws=null, поскольку HTTP

                if (response.idTagInfo.status === 'Accepted') {
                    // Отправляем RemoteStartTransaction по WS к станции
                    sendRemoteStartTransaction(connectionManager, chargePointId, {
                        idTag,
                        connectorId,
                        startValue: 0  // meterStart
                    });
                    logger.info(`[API] Start-session initiated for ${chargePointId}, connector ${connectorId}, limits: type=${limitType}, value=${limitValue}`);
                    sendJson(res, 200, { success: true, message: 'Session started', transactionId: response.transactionId });
                } else {
                    sendJson(res, 400, { success: false, error: 'Start rejected' });
                }
            } catch (err) {
                logger.error(`[API] start-session Error: ${err}`);
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
                logger.info(`[API] stop-session received: transactionId=${transactionId}, type=${typeof transactionId}`);
                if (!transactionId || !chargePointId || !connectorId || !idTag) {
                    sendJson(res, 400, { success: false, error: 'Missing required fields' });
                    return;
                }
                // Формируем payload для StopTransaction
                logger.info(`[API] stop-session using transactionId as string: ${transactionId}, type=${typeof transactionId}`);
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
                } else {
                    sendJson(res, 400, { success: false, error: 'Stop rejected' });
                }
            } catch (err) {
                logger.error(`[API] stop-session Error: ${err}`);
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