import { UpdateFirmwareRequest } from '../../../types/1.6/UpdateFirmware';
import { UpdateFirmwareResponse } from '../../../types/1.6/UpdateFirmwareResponse';
import { Firmware } from '../../db/mongoose';
import { Log } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleUpdateFirmware(req: UpdateFirmwareRequest, chargePointId: string, ws: WebSocket): Promise<UpdateFirmwareResponse> {
    try {
        await Firmware.findOneAndUpdate(
            { chargePointId },
            { firmwareVersion: Date.now(),
            status: 'Downloaded' },
            { upsert: true }
        );
        await Log.create({ action: 'UpdateFirmware', chargePointId, payload: req });
        logger.info(`Update firmware for ${chargePointId}: version ${Date.now()}`);
        return {};
    } catch (err) {
        logger.error(`Error in UpdateFirmware: ${err}`);
        return {};
    }
}