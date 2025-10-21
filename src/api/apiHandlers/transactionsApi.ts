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
 * GET /api/transactions/recent
 * Возвращает последние 10 транзакций из памяти connectionManager
 * Эти транзакции содержат как начальные, так и конечные данные (если транзакция завершена)
 */
export function recentTransactionsApiHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        const url = new URL(req.url || '', 'http://localhost:8081');
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 10;

        // Получаем последние транзакции из connectionManager
        const recentTransactions = connectionManager.getRecentTransactions(limit);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: recentTransactions,
            count: recentTransactions.length
        }));
        logger.info(`[API] /api/transactions/recent returned ${recentTransactions.length} transactions (limit: ${limit})`);
    } catch (err) {
        logger.error(`[API] /api/transactions/recent error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}

/**
 * POST /api/transactions/recent
 * Вручную добавляет транзакцию в список недавних (для тестирования)
 * Body: { transactionId, chargePointId, connectorId, idTag, startTime, stopTime, ... }
 */
export function addRecentTransactionHandler(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const body = await readBody(req);

            // Валидация обязательных полей
            if (!body.transactionId || !body.chargePointId || !body.connectorId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Missing required fields: transactionId, chargePointId, connectorId'
                }));
                return;
            }

            // Добавляем транзакцию
            connectionManager.addRecentTransaction({
                transactionId: body.transactionId,
                chargePointId: body.chargePointId,
                connectorId: body.connectorId,
                idTag: body.idTag || 'MANUAL',
                startTime: body.startTime || new Date().toISOString(),
                meterStart: body.meterStart || 0,
                stopTime: body.stopTime || new Date().toISOString(),
                meterStop: body.meterStop || 0,
                totalKWh: body.totalKWh || 0,
                cost: body.cost || 0,
                efficiencyPercentage: body.efficiencyPercentage || 0,
                reason: body.reason || 'Manual',
                status: 'Completed'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Transaction added manually',
                transactionId: body.transactionId
            }));
            logger.info(`[API] Manually added transaction ${body.transactionId}`);
        } catch (err) {
            logger.error(`[API] POST /api/transactions/recent error: ${err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
        }
    })();
}

/**
 * DELETE /api/transactions/recent
 * Очищает все недавние транзакции из памяти (connectionManager)
 * Это админ-функция для сброса списка недавних транзакций
 */
export function clearRecentTransactionsMemoryHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        const clearedCount = connectionManager.clearRecentTransactions();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: `Cleared ${clearedCount} recent transactions from memory`,
            cleared: clearedCount
        }));
        logger.info(`[API] /api/transactions/recent DELETE cleared ${clearedCount} transactions from memory`);
    } catch (err) {
        logger.error(`[API] /api/transactions/recent DELETE error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}

/**
 * GET /api/transactions
 * Возвращает транзакции из PostgreSQL
 */

export function transactionsApiHandler(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            const { AppDataSource } = require('../../db/postgres');
            const { Transaction } = require('../../db/entities/Transaction');
            const url = new URL(req.url || '', 'http://localhost:8081');
            const chargePointId = url.searchParams.get('chargePointId');

            const repo = AppDataSource.getRepository(Transaction);
            const where: any = {};
            if (chargePointId) where.chargePointId = chargePointId;

            const transactions = await repo.find({
                where,
                order: { startTime: 'DESC' },
                take: 100
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: transactions, count: transactions.length }));
            logger.info(`[API] /api/transactions returned ${transactions.length} transactions`);
        } catch (err) {
            logger.error(`[API] /api/transactions error: ${err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
        }
    })();
}

/**
 * POST /api/transactions/clear
 * Очищает старые транзакции из БД (опционально, для админов)
 */
export async function clearRecentTransactionsHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        const body = await readBody(req);
        const { olderThanDays = 30 } = body;

        const { AppDataSource } = require('../../db/postgres');
        const { Transaction } = require('../../db/entities/Transaction');

        const repo = AppDataSource.getRepository(Transaction);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        // Для TypeORM/Postgres используем QueryBuilder для удаления с условием
        const deleteResult = await repo.createQueryBuilder()
            .delete()
            .from(Transaction)
            .where('stopTime < :cutoffDate', { cutoffDate })
            .execute();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: `Deleted transactions older than ${olderThanDays} days`,
            deleted: deleteResult.affected || 0
        }));
        logger.info(`[API] /api/transactions/clear deleted ${deleteResult.affected || 0} old transactions`);
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
 * body: { chargePointId, connectorId } - transactionId опционален
 * Если transactionId не указан, автоматически находим активную транзакцию для коннектора
 */
export async function stopRemoteTrx(req: IncomingMessage, res: ServerResponse) {
    try {
        const body = await readBody(req);
        let { chargePointId, connectorId, transactionId } = body || {};

        if (!chargePointId || !connectorId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: chargePointId, connectorId' }));
            return;
        }

        // Если transactionId не передан - находим его по коннектору
        if (!transactionId) {
            const connectorState = connectionManager.getConnectorState(chargePointId, connectorId);
            if (!connectorState || !connectorState.transactionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: `No active transaction found for connector ${connectorId} on station ${chargePointId}`
                }));
                return;
            }
            transactionId = connectorState.transactionId;
            logger.info(`[API] Auto-resolved transactionId: ${transactionId} for connector ${connectorId} on ${chargePointId}`);
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
            res.end(JSON.stringify({
                success: true,
                message: 'RemoteStopTransaction sent via WebSocket',
                transactionId
            }));
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

/**
 * POST /api/stations/:stationId/start
 * Wrapper для startRemoteTrx (алиас для фронтенда)
 * Body: { connectorId, idTag? }
 */
export function startChargingByStationId(req: IncomingMessage, res: ServerResponse, stationId: string) {
    (async () => {
        try {
            const body = await readBody(req);

            if (!body.connectorId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing connectorId' }));
                return;
            }

            // Трансформируем в формат startRemoteTrx
            const transformedBody = {
                chargePointId: stationId,
                connectorId: body.connectorId,
                idTag: body.idTag || 'FRONTEND_USER',
                startValue: body.startValue || 0
            };

            logger.info(`[API] /api/stations/${stationId}/start → startRemoteTrx with body: ${JSON.stringify(transformedBody)}`);

            // Проверяем что станция онлайн
            const connections = connectionManager.getAllConnections();
            if (!connections || !connections.has(stationId)) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Station is offline',
                    message: 'Please select another station'
                }));
                return;
            }

            // Вызываем sendRemoteStartTransaction
            sendRemoteStartTransaction(connectionManager, stationId, {
                connectorId: transformedBody.connectorId,
                idTag: transformedBody.idTag,
                startValue: transformedBody.startValue
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Remote start requested'
            }));
        } catch (err) {
            logger.error(`[API] /api/stations/:id/start Error: ${err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Start charging error' }));
        }
    })();
}

/**
 * POST /api/stations/:stationId/stop
 * Wrapper для stopRemoteTrx (алиас для фронтенда)
 * Body: { transactionId, connectorId? }
 */
export function stopChargingByStationId(req: IncomingMessage, res: ServerResponse, stationId: string) {
    (async () => {
        try {
            const body = await readBody(req);

            if (!body.transactionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing transactionId' }));
                return;
            }

            logger.info(`[API] /api/stations/${stationId}/stop → stopRemoteTrx with transactionId: ${body.transactionId}`);

            // Проверяем что станция онлайн
            const connections = connectionManager.getAllConnections();
            if (!connections || !connections.has(stationId)) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Station is offline',
                    message: 'Station is unavailable'
                }));
                return;
            }

            // Вызываем sendRemoteStopTransaction
            sendRemoteStopTransaction(connectionManager, stationId, {
                transactionId: body.transactionId,
                connectorId: body.connectorId,
                reason: body.reason || 'Remote'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Remote stop requested'
            }));
        } catch (err) {
            logger.error(`[API] /api/stations/:id/stop Error: ${err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Stop charging error' }));
        }
    })();
}