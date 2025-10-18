"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionsApiHandler = transactionsApiHandler;
exports.clearRecentTransactionsHandler = clearRecentTransactionsHandler;
exports.startRemoteTrx = startRemoteTrx;
exports.stopRemoteTrx = stopRemoteTrx;
const index_1 = require("../../server/index");
const logger_1 = require("../../logger");
const remoteControl_1 = require("../../server/remoteControl");
const STATION_URL = 'http://localhost:3000'; // при необходимости вынести в config
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}
/**
 * GET /api/transactions
 * Возвращает транзакции из PostgreSQL
 */
function transactionsApiHandler(req, res) {
    (async () => {
        try {
            const { AppDataSource } = require('../../db/postgres');
            const { Transaction } = require('../../db/entities/Transaction');
            const url = new URL(req.url || '', 'http://localhost:8081');
            const chargePointId = url.searchParams.get('chargePointId');
            const repo = AppDataSource.getRepository(Transaction);
            const where = {};
            if (chargePointId)
                where.chargePointId = chargePointId;
            const transactions = await repo.find({
                where,
                order: { startTime: 'DESC' },
                take: 100
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: transactions, count: transactions.length }));
            logger_1.logger.info(`[API] /api/transactions returned ${transactions.length} transactions`);
        }
        catch (err) {
            logger_1.logger.error(`[API] /api/transactions error: ${err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
        }
    })();
}
/**
 * POST /api/transactions/clear
 * Очищает старые транзакции из БД (опционально, для админов)
 */
async function clearRecentTransactionsHandler(req, res) {
    try {
        const body = await readBody(req);
        const { olderThanDays = 30 } = body;
        const { AppDataSource } = require('../../db/postgres');
        const { Transaction } = require('../../db/entities/Transaction');
        const repo = AppDataSource.getRepository(Transaction);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const result = await repo.delete({
            stopTime: { $lt: cutoffDate }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: `Deleted transactions older than ${olderThanDays} days`,
            deleted: result.affected || 0
        }));
        logger_1.logger.info(`[API] /api/transactions/clear deleted ${result.affected || 0} old transactions`);
    }
    catch (err) {
        logger_1.logger.error(`[API] clear /api/transactions error: ${err}`);
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
async function startRemoteTrx(req, res) {
    try {
        const body = await readBody(req);
        const { chargePointId, connectorId, idTag, startValue } = body || {};
        if (!chargePointId || !connectorId || !idTag) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: chargePointId, connectorId, idTag' }));
            return;
        }
        // проверяем онлайн-статус через connectionManager
        const stationsMap = typeof index_1.connectionManager.getAllChargePointsWithConnectors === 'function'
            ? index_1.connectionManager.getAllChargePointsWithConnectors()
            : null;
        const isOnline = stationsMap ? stationsMap.has(chargePointId) : false;
        if (isOnline) {
            (0, remoteControl_1.sendRemoteStartTransaction)(index_1.connectionManager, chargePointId, {
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
        }
        catch (err) {
            logger_1.logger.warn(`[API] startRemoteTrx: station offline and /start-station call failed: ${err}`);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Station offline and cannot reach station HTTP endpoint. Use WebSocket or start station process.'
            }));
            return;
        }
    }
    catch (err) {
        logger_1.logger.error(`[API] startRemoteTrx Error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Remote start session error' }));
    }
}
/**
 * POST /api/remote-stop-session
 * body: { chargePointId, connectorId, transactionId }
 */
async function stopRemoteTrx(req, res) {
    try {
        const body = await readBody(req);
        const { chargePointId, connectorId, transactionId } = body || {};
        if (!chargePointId || !connectorId || !transactionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: chargePointId, connectorId, transactionId' }));
            return;
        }
        const stationsMap = typeof index_1.connectionManager.getAllChargePointsWithConnectors === 'function'
            ? index_1.connectionManager.getAllChargePointsWithConnectors()
            : null;
        const isOnline = stationsMap ? stationsMap.has(chargePointId) : false;
        if (isOnline) {
            (0, remoteControl_1.sendRemoteStopTransaction)(index_1.connectionManager, chargePointId, {
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
        }
        catch (err) {
            logger_1.logger.warn(`[API] stopRemoteTrx: station offline and /stop-station call failed: ${err}`);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Station offline and cannot reach station HTTP endpoint. Use WebSocket or start station process.'
            }));
            return;
        }
    }
    catch (err) {
        logger_1.logger.error(`[API] stopRemoteTrx Error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Remote stop session error' }));
    }
}
