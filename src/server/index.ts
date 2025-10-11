import { createServer, IncomingMessage, ServerResponse } from 'http';
import { StartTransactionRequest } from './types/1.6/StartTransaction'
import { URL, URLSearchParams } from 'url';  // Для парсинга путей и query
import { WsServer } from './wsServer';
import { ConnectionManager } from './connectionManager';
import { logger } from '../logger';
import { connectDB } from '../db/mongoose';
import { Transaction } from '../db/mongoose';  // Для запросов к БД
import { sendRemoteStartTransaction, sendReserveNow } from './remoteControl';  // Для резервирования
import { handleStartTransaction } from "./handlers/startTransaction"

const PORT = 8081;

// Создаём HTTP-сервер
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS для фронтенда
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    logger.info(`[index API] Access-Control allow methods : GET, POST; allow headers Content-Type, Authorization`)

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        logger.info(`[index API], request method OPTIONS`)
        return;
    }

    // WS-эндпоинт (ваш существующий)
    if (req.method === 'GET' && req.url?.startsWith('/ocpp')) {
        logger.info(`[index API], request method GET on "/ocpp", delegated to [WsServer]`)
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
                const stations = await connectionManager.getAllChargePointsWithConnectors();  // Ваш метод, если есть; иначе из ChargePoint.find()
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: Array.from(stations.entries()) }));
                logger.info(`[index API], request method GET on "/api/stations; sending response: ${Array.from(stations.entries())}`)
            } catch (err) {
                logger.error(`[index API] Stations query error: ${err}`);
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

                const transactions = await Transaction.find(filter).sort({ startTime: -1 }).limit(100);
                logger.info(`[index API], request method GET on "/api/transactions; sending response: ${transactions}`)

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: transactions }));
            } catch (err) {
                logger.error(`[index API] Transactions query error: ${err}`);
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
                logger.info(`[index API], request method GET on "/api/metrics/${chargePointId}; sending response: ${{ totalKWh, cost: cost.toFixed(2) }}`)

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: { totalKWh, cost: cost.toFixed(2) } }));
            } catch (err) {
                logger.error(`[index API] Metrics error for ${chargePointId}: ${err}`);
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

    // POST /api/reserve — резервирование (пример)
    if (req.method === 'POST' && pathname === '/api/reserve') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chargePointId, connectorId, idTag, expiryMinutes } = JSON.parse(body);
                if (!chargePointId || !connectorId || !idTag) {
                    logger.warn(`[index API], request method GET on "/api/reserve" without required fields`)
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
                    return;
                }
                sendReserveNow(connectionManager, chargePointId, connectorId, idTag, new Date(Date.now() + expiryMinutes * 60000));

                logger.info(`[index API], request method GET on "/api/reserve"; reserrved: ${chargePointId} ${connectorId} ${idTag}}`)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Reservation sent' }));
            } catch (err) {
                logger.error(`[index API] Reserve error: ${err}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
            }
        });
        return;
    }

    // Дефолтный обработчик
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`CSMS WebSocket endpoint: ws://localhost:${PORT}/ocpp\n`);
});

export let connectionManager = new ConnectionManager();

// Создаём WS-сервер
const wsServer = new WsServer(httpServer, connectionManager);

// Graceful shutdown
export let shutdownTimeout: NodeJS.Timeout | null = null;
const SHUTDOWN_TIMEOUT = 30000;  // 30 секунд на завершение соединений

function initiateShutdown(signal: string) {
    logger.info(`[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

    // Закрываем новые подключения в WS
    wsServer.closeNewConnections();

    // Устанавливаем таймаут для принудительного завершения
    shutdownTimeout = setTimeout(() => {
        logger.warn(`[SHUTDOWN] Force closing after ${SHUTDOWN_TIMEOUT}ms`);
        httpServer.close(() => {
            process.exit(1);  // Принудительное завершение
        });
    }, SHUTDOWN_TIMEOUT);

    // Ждём закрытия всех соединений
    const checkConnections = () => {
        const remaining = connectionManager.getAllConnections()?.size || 0;
        if (remaining === 0) {
            logger.info('[SHUTDOWN] All connections closed. Shutting down.');
            clearTimeout(shutdownTimeout!);
            httpServer.close(() => process.exit(0));
        } else {
            logger.info(`[SHUTDOWN] Waiting for ${remaining} connections to close...`);
            setTimeout(checkConnections, 1000);  // Проверяем каждую секунду
        }
    };

    setImmediate(checkConnections);
}

// Обработка сигналов
process.on('SIGINT', () => initiateShutdown('SIGINT'));
process.on('SIGTERM', () => initiateShutdown('SIGTERM'));

httpServer.on('error', (error) => {
    logger.error(`[HTTP_SERVER] Error: ${error.message}`);
});

(async () => {
    await connectDB();
    logger.info('[HTTP_SERVER] Starting HTTP server...');
    httpServer.listen(PORT, () => {
        logger.info(`[MAIN] CSMS Server fully initialized on port ${PORT}`);
    });
})();