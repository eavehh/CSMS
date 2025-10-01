import { GetConfigurationRequest } from '../../../types/1.6/GetConfiguration';
import { GetConfigurationResponse} from '../../../types/1.6/GetConfigurationResponse';
import { ConfigurationKey } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleGetConfiguration(req: GetConfigurationRequest, chargePointId: string, ws: WebSocket): Promise<GetConfigurationResponse> {
  try {
    const configs = await ConfigurationKey.find({ chargePointId });
    const responseKey = configs.map(c => ({ key: c.key, readonly: c.readonly, value: c.value }));
    await Log.create({ action: 'GetConfiguration', chargePointId, payload: req });
    logger.info(`Get config from ${chargePointId}: keys ${req.key?.join(',') || 'all'}`);
    return { configurationKey: responseKey };
  } catch (err) {
    logger.error(`Error in GetConfiguration: ${err}`);
    return { configurationKey: [] };
  }
}