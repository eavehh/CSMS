import { GetLocalListVersionRequest } from '../../../types/1.6/GetLocalListVersion';
import { GetLocalListVersionResponse } from '../../../types/1.6/GetLocalListVersionResponse';
import { LocalList } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleGetLocalListVersion(req: GetLocalListVersionRequest, chargePointId: string, ws: WebSocket): Promise<GetLocalListVersionResponse> {
    try {
        const list = await LocalList.findOne({ chargePointId }).sort({ updatedAt: -1 });
        const version = list ? list.listVersion : 0;
        await Log.create({ action: 'GetLocalListVersion', chargePointId, payload: req });
        logger.info(`Get local list version for ${chargePointId}: ${version}`);
        return { listVersion: version };
    } catch (err) {
        logger.error(`Error in GetLocalListVersion: ${err}`);
        return { listVersion: 0 };
    }
}