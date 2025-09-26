import { ChangeConfigurationRequest } from '../../types/ocpp/1.6/ChangeConfiguration';
import { ChangeConfigurationResponse } from '../../types/ocpp/1.6/ChangeConfigurationResponse';
import { Config } from '../db/mongoose';  // DB для config
import { logger } from '../server/logger';
import WebSocket from 'ws';

export async function handleChangeConfiguration(req: ChangeConfigurationRequest, chargePointId: string, ws: WebSocket): Promise<ChangeConfigurationResponse> {
    try {
        const configurationKey = (req as any).configurationKey || [];
        for (const conf of configurationKey) {
            await Config.findOneAndUpdate(
                { chargePointId, key: conf.key },
                { chargePointId, key: conf.key, value: conf.value, readonly: false },
                { upsert: true }
            );
        }
        logger.info(`Change config on ${chargePointId}: keys ${configurationKey.map(k => k.key).join(',')}`);
        return { status: 'Accepted' };
    } catch (err) {
        logger.error(`DB error in ChangeConfiguration: ${err.message}`);
        return { status: 'Rejected' };
    }
}