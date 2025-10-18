"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionsApiHandler = transactionsApiHandler;
exports.startRemoteTrx = startRemoteTrx;
exports.stopRemoteTrx = stopRemoteTrx;
const logger_1 = require("../../logger");
const httpHandlers_1 = require("../httpHandlers");
const remoteControl_1 = require("../../server/remoteControl");
const index_1 = require("../../server/index");
function transactionsApiHandler(req, res) {
    try {
        const data = index_1.connectionManager.getRecentTransactions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        logger_1.logger.info('[API] /api/transactions returned recent transactions');
    }
    catch (err) {
        logger_1.logger.error(`[API] /api/transactions error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}
function startRemoteTrx(req, res) {
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
            (0, httpHandlers_1.sendJson)(res, 200, { success: true, message: 'RemoteStartTransaction sent' });
        }
        catch (err) {
            logger_1.logger.error(`[API] remote-start-session Error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Remote start session error' });
        }
    });
    return;
}
async function stopRemoteTrx(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { chargePointId, connectorId, transactionId } = JSON.parse(body);
            if (!chargePointId || !connectorId || !transactionId) {
                (0, httpHandlers_1.sendJson)(res, 200, { success: true, message: 'No action taken, missing required fields' });
                return;
            }
            // Отправляем RemoteStopTransaction по WS к станции
            const { sendRemoteStopTransaction } = require('./remoteControl');
            sendRemoteStopTransaction(index_1.connectionManager, chargePointId, {
                connectorId,
                transactionId
            });
            logger_1.logger.info(`[API] RemoteStopTransaction sent for ${chargePointId}, connector ${connectorId}, tx ${transactionId}`);
            (0, httpHandlers_1.sendJson)(res, 200, { success: true, message: 'RemoteStopTransaction sent' });
        }
        catch (err) {
            logger_1.logger.error(`[API] remote-stop-session Error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Remote stop session error' });
        }
    });
    return;
}
