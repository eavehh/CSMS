import { IncomingMessage, ServerResponse } from 'http';
import { connectionManager } from '../../server/index';
import { logger } from '../../logger';
import { sendRemoteStartTransaction, sendRemoteStopTransaction } from '../../server/remoteControl';

const STATION_URL = 'http://localhost:3000'; // при необходимости вынести в config

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
 * GET /api/transactions
 * Возвращает последние (до 30) транзакций из connectionManager
 */
export function transactionsApiHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        const data = connectionManager.getRecentTransactions ? connectionManager.getRecentTransactions() : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        logger.info('[API] /api/transactions returned recent transactions');
    } catch (err) {
        logger.error(`[API] /api/transactions error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}

/**
 * POST /api/transactions/clear
 * Очищает буфер последних транзакций
 */
export async function clearRecentTransactionsHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        if (typeof connectionManager.clearRecentTransactions === 'function') {
            connectionManager.clearRecentTransactions();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Recent transactions cleared' }));
        logger.info('[API] /api/transactions/clear cleared recent transactions');
    } catch (err) {
        logger.error(`[API] clear /api/transactions error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}

/**
 * POST /api/remote-start-session
 * body: { chargePointId, connectorId, idTag, startValue? }
 * Если станция онлайн — отправляем RemoteStartTransaction по WS.
 * Если оффлайн — пробуем вызвать локальный HTTP /start-station (если доступен).
 */
export async function startRemoteTrx(req: IncomingMessage, res: ServerResponse) {
    try {
        const body = await readBody(req);
        const { chargePointId, connectorId, idTag, startValue } = body || {};

        if (!chargePointId || !connectorId || !idTag) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: chargePointId, connectorId, idTag' }));
            return;
        }

        // проверяем онлайн-статус через connectionManager
        const stationsMap = typeof connectionManager.getAllChargePointsWithConnectors === 'function'
            ? connectionManager.getAllChargePointsWithConnectors()
            : null;

        const isOnline = stationsMap ? stationsMap.has(chargePointId) : false;

        if (isOnline) {
            sendRemoteStartTransaction(connectionManager, chargePointId, {
                idTag,
                connectorId,
                startValue: startValue || 0
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'RemoteStartTransaction sent via WebSocket' }));
            return;
        }

        // Станция оффлайн — попробуем вызвать её HTTP /start-station (если локально доступна)
        try {
            const resp = await fetch(`${STATION_URL}/start-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chargePointId })
            });
            const data = await resp.json().catch(() => null);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Station is offline. Requested station process start via HTTP.',
                stationResponse: data || null
            }));
            return;
        } catch (err) {
            logger.warn(`[API] startRemoteTrx: station offline and /start-station call failed: ${err}`);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Station offline and cannot reach station HTTP endpoint. Use WebSocket or start station process.'
            }));
            return;
        }
    } catch (err) {
        logger.error(`[API] startRemoteTrx Error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Remote start session error' }));
    }
}

/**
 * POST /api/remote-stop-session
 * body: { chargePointId, connectorId, transactionId }
 */
export async function stopRemoteTrx(req: IncomingMessage, res: ServerResponse) {
    try {
        const body = await readBody(req);
        const { chargePointId, connectorId, transactionId } = body || {};

        if (!chargePointId || !connectorId || !transactionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: chargePointId, connectorId, transactionId' }));
            return;
        }

        const stationsMap = typeof connectionManager.getAllChargePointsWithConnectors === 'function'
            ? connectionManager.getAllChargePointsWithConnectors()
            : null;

        const isOnline = stationsMap ? stationsMap.has(chargePointId) : false;

        if (isOnline) {
            sendRemoteStopTransaction(connectionManager, chargePointId, {
                connectorId,
                transactionId
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'RemoteStopTransaction sent via WebSocket' }));
            return;
        }

        // Станция оффлайн — пробуем вызвать локальный HTTP /stop-station (опционально)
        try {
            const resp = await fetch(`${STATION_URL}/stop-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chargePointId })
            });
            const data = await resp.json().catch(() => null);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Station is offline. Requested station process stop via HTTP.',
                stationResponse: data || null
            }));
            return;
        } catch (err) {
            logger.warn(`[API] stopRemoteTrx: station offline and /stop-station call failed: ${err}`);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Station offline and cannot reach station HTTP endpoint. Use WebSocket or start station process.'
            }));
            return;
        }
    } catch (err) {
        logger.error(`[API] stopRemoteTrx Error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Remote stop session error' }));
    }
}