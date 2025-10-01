import { MeterValuesRequest } from '../../types/1.6/MeterValues';
import { MeterValuesResponse } from '../../types/1.6/MeterValuesResponse';
import { Transaction } from '../db/mongoose';
import { Log } from '../db/mongoose';
import { logger } from '../logger';
import WebSocket from 'ws';

export async function handleMeterValues(req: MeterValuesRequest, chargePointId: string, ws: WebSocket): Promise<MeterValuesResponse> {
    try {
        // Обнови tx energy, если txId
        if (req.transactionId) {
            await Transaction.findOneAndUpdate(
                { id: req.transactionId },
                { energy: req.meterValue[0]?.sampledValue[0]?.value },  // Пример
                { upsert: true }
            );
        }
        await Log.create({ action: 'MeterValues', chargePointId, payload: req });
        logger.info(`Meter from ${chargePointId}: ${req.meterValue[0]?.sampledValue[0]?.value} kWh`);
        return {};
    } catch (err) {
        logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}