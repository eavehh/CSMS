import { SendLocalListRequest } from '../../server/types/1.6/SendLocalList';
import { SendLocalListResponse } from '../../server/types/1.6/SendLocalListResponse';
import { LocalList } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { sendRemoteMessage } from '../remoteControl';
import { logger } from '../../logger';
import WebSocket from 'ws';
import { connectionManager } from '../../server';  // Или передай param

export async function handleSendLocalList(req: SendLocalListRequest, chargePointId: string, ws: WebSocket): Promise<SendLocalListResponse> {
  try {
    await LocalList.findOneAndUpdate(
      { chargePointId },
      {
        chargePointId,
        listVersion: req.listVersion,
        localList: req.localAuthorizationList || [],
        updatedAt: new Date()
      },
      { upsert: true }
    );
    // Отправь зарядке (сервер → клиент)
    sendRemoteMessage(connectionManager, chargePointId, 'SendLocalList', {
      listVersion: req.listVersion,
      localList: req.localAuthorizationList || []
    });
    await Log.create({ action: 'SendLocalList', chargePointId, payload: req });
    logger.info(`Send LocalList v${req.listVersion} to ${chargePointId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in SendLocalList: ${err}`);
    return { status: 'Failed' };
  }
}