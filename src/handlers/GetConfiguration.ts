import { unchangedTextChangeRange } from 'typescript';
import { GetConfigurationRequest } from '../../types/1.6/GetConfiguration';
import { GetConfigurationResponse } from '../../types/1.6/GetConfigurationResponse';
import { ConfigurationKey } from '../db/mongoose';
import { Log } from '../db/mongoose';
import { logger } from '../logger';
import WebSocket from 'ws';

export async function handleGetConfiguration(req: GetConfigurationRequest, chargePointId: string, ws: WebSocket): Promise<GetConfigurationResponse> {
    try {
        let configs;
        if (req.key && req.key.length > 0) {
            configs = await ConfigurationKey.find({ chargePointId, key: { $in: req.key } });
        } else {
            configs = await ConfigurationKey.find({ chargePointId });
        }

        const responseKey = configs.map(c => ({
            key: c.key,
            readonly: c.readonly,
            value: c.value || undefined  // Фикс null undefined, тип совпадёт
        })).filter(c => c.value !== undefined || c.readonly);  // Опционально: фильтр если value null 

        await Log.create({ action: 'GetConfiguration', chargePointId, payload: req });
        logger.info(`Get config from ${chargePointId}: keys ${req.key ? req.key.join(', ') : 'all'}`);
        return { configurationKey: responseKey };
    } catch (err) {
        logger.error(`Error in GetConfiguration: ${err}`);
        return { configurationKey: [] };
    }
}