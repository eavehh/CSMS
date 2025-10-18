import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { AppDataSource } from '../../db/postgres';
import { Transaction } from '../../db/entities/Transaction';
import { sendJson } from '../httpHandlers'
import { sendRemoteStartTransaction } from '../../server/remoteControl';
import { connectionManager } from '../../server/index';


export function transactionsApiHandler(req: IncomingMessage, res: ServerResponse) {
    try {
        const data = connectionManager.getRecentTransactions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        logger.info('[API] /api/transactions returned recent transactions');
    } catch (err) {
        logger.error(`[API] /api/transactions error: ${err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
}

export function startRemoteTrx(req: IncomingMessage, res: ServerResponse) {
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

export async function stopRemoteTrx(req: IncomingMessage, res: ServerResponse) {
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