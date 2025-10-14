import { IncomingMessage, ServerResponse } from 'http';
import { StartTransactionRequest } from './types/1.6/StartTransaction'
import { URL, URLSearchParams } from 'url';
import { logger } from '../logger';
import { connectionManager } from './index';
import { sendReserveNow, sendRemoteStartTransaction } from './remoteControl';
import { handleStartTransaction } from './handlers/startTransaction';
import { Transaction } from '../db/entities/Transaction';
import { MeterValue } from '../db/entities/MeterValue';
import { AppDataSource } from '../db/postgres';


const PORT = 8081;  // Импорт из index, если нужно

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

    // Новый REST API
    const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.searchParams;

    // GET /api/stations — список станций
    if (req.method === 'GET' && pathname === '/api/stations') {
        (async () => {
            try {
                const stationsMap = await connectionManager.getAllChargePointsWithConnectors();
                const data = Array.from(stationsMap.entries()).map(([stationId, connectors]) => ({
                    id: stationId,
                    connectors: Array.from(connectors.entries()).map(([id, state]) => ({ id, ...state }))
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
                logger.info(`[httpHandlers] GET /api/stations; response: ${JSON.stringify(data).slice(0, 500)}...`)
            } catch (err) {
                logger.error(`[httpHandlers] Stations query error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
            }
        })();
        return;
    }

    // GET /api/transactions — список транзакций (опционально с фильтрами)
    if (req.method === 'GET' && pathname === '/api/transactions') {
        const chargePointId = query.get('chargePointId');
        const from = query.get('from');
        const to = query.get('to');
        (async () => {
            try {
                let filter: any = {};
                if (chargePointId) filter.chargePointId = chargePointId;
                if (from) filter.startTime = { $gte: new Date(from) };
                if (to) filter.startTime = { ...filter.startTime, $lte: new Date(to) };

                const repo = AppDataSource.getRepository(Transaction);
                const transactions = await repo.find({
                    where: filter,
                    order: { startTime: 'DESC' },
                    take: 100
                }); logger.info(`[httpHandlers] GET /api/transactions; response size=${transactions.length}`)

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: transactions }));
            } catch (err) {
                logger.error(`[httpHandlers] Transactions query error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
            }
        })();
        return;
    }

    // GET /api/metrics/:chargePointId — метрики (ваш существующий)
    if (req.method === 'GET' && pathname.startsWith('/api/metrics/')) {
        const chargePointId = pathname.split('/')[3];
        if (!chargePointId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing chargePointId' }));
            return;
        }

        const from = query.get('from');
        const to = query.get('to');
        let fromDate = from ? new Date(from) : new Date('1970-01-01');
        let toDate = to ? new Date(to) : new Date();

        (async () => {
            try {
                const totalKWh = await connectionManager.getTotalKWh(chargePointId, fromDate, toDate);
                const cost = totalKWh * 0.1;
                logger.info(`[httpHandlers] GET /api/metrics/${chargePointId}; response: ${JSON.stringify({ totalKWh, cost: Number(cost.toFixed(2)) })}`)

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: { totalKWh, cost: cost.toFixed(2) } }));
            } catch (err) {
                logger.error(`[httpHandlers] Metrics error for ${chargePointId}: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Calculation error' }));
            }
        })();
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
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
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
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Session started with limits', transactionId: response.transactionId }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Start rejected' }));
                }
            } catch (err) {
                logger.error(`[API] start-session Error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Start session error' }));
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
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
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
                    res.end(JSON.stringify({ success: true, message: 'Session stopped', transactionId }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Stop rejected' }));
                }
            } catch (err) {
                logger.error(`[API] stop-session Error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Stop session error' }));
            }
        });
        return;
    }

    // POST /api/reserve — резервирование (пример)
    if (req.method === 'POST' && pathname === '/api/reserve') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId, connectorId, idTag, expiryMinutes } = JSON.parse(body);
                if (!chargePointId || !connectorId || !idTag) {
                    logger.warn(`[httpHandlers] POST /api/reserve missing required fields`)
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
                    return;
                }
                sendReserveNow(connectionManager, chargePointId, connectorId, idTag, new Date(Date.now() + expiryMinutes * 60000));

                logger.info(`[httpHandlers] POST /api/reserve; reserved: ${chargePointId} ${connectorId} ${idTag}`)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Reservation sent' }));
            } catch (err) {
                logger.error(`[httpHandlers] Reserve error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
            }
        });
        return;
    }

    // Дефолтный обработчик
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}/ocpp\n`);




    // =============================
    // 🔹 GET /api/admin/stations
    // Возвращает список всех подключенных станций
    // =============================
    if (req.method === 'GET' && pathname === '/api/admin/stations') {
        (async () => {
            try {
                const stationsMap = await connectionManager.getAllChargePointsWithConnectors();
                const data = Array.from(stationsMap.entries()).map(([stationId, connectors]) => ({
                    id: stationId,
                    connectors: Array.from(connectors.entries()).map(([id, state]) => ({
                        id,
                        status: state.status || 'Unknown',
                    })),
                }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
                logger.info(`[ADMIN_API] GET /api/admin/stations; ${data.length} stations returned`);
            } catch (err) {
                logger.error(`[ADMIN_API] /api/admin/stations error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal error' }));
            }
        })();
        return;
    }

}