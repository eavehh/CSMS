import { ClearCacheRequest } from '../../server/types/1.6/ClearCache';
import { ClearCacheResponse } from '../../server/types/1.6/ClearCacheResponse';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleClearCache(req: ClearCacheRequest, chargePointId: string, ws: WebSocket): Promise<ClearCacheResponse> {
  try {
    // Логика: очисти локальный кэш на Charge Point (сервер не хранит)
    await Log.create({ action: 'ClearCache', chargePointId, payload: req });
    logger.info(`Clear cache for ${chargePointId}`);
    return { status: 'Accepted' };
  } catch (err) {
    logger.error(`Error in ClearCache: ${err}`);
    return { status: 'Rejected' };
  }
}