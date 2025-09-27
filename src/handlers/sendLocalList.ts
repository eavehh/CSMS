import { SendLocalListRequest } from '../../types/1.6/SendLocalList';
import { SendLocalListResponse } from '../../types/1.6/SendLocalListResponse';
import { LocalList } from '../db/mongoose';
import { sendRemoteMessage } from '../utils/RemoteControl';  
import { ConnectionManager } from '../server/connectionManager';  
import { logger } from '../server/logger';
import WebSocket from 'ws';

export async function handleSendLocalList(req: SendLocalListRequest, chargePointId: string, ws: WebSocket, connectionManager: ConnectionManager): Promise<SendLocalListResponse> {
    try {
        await LocalList.findOneAndUpdate(
            { chargePointId },
            { version: req.listVersion, updatedAt: new Date() },
            { upsert: true }
        );

        sendRemoteMessage(connectionManager, chargePointId, 'SendLocalList', { listVersion: req.listVersion, localList: req.localAuthorizationList || [] });

        logger.info(`Отправил список карт версии ${req.listVersion} на ${chargePointId}`);
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`Ошибка в sendLocalList: ${err.message}`);
        return { status: 'Failed' };
    }
}