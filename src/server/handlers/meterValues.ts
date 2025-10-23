import { MeterValuesRequest } from '../types/1.6/MeterValues';
import { MeterValuesResponse } from '../types/1.6/MeterValuesResponse';
import { AppDataSource } from '../../db/postgres'
import { MeterValue } from '../../db/entities/MeterValue';
import { Transaction } from '../../db/entities/Transaction';
import { logger } from '../../logger';
import { connectionManager } from '../../server/index';
import WebSocket from 'ws';

export async function handleMeterValues(req: MeterValuesRequest, chargePointId: string, ws: WebSocket): Promise<MeterValuesResponse> {
    try {
        const transactionId = req.transactionId ? req.transactionId.toString() : undefined;
        const samples = (req.meterValue || []).map(mv => ({
            transactionId,
            connectorId: req.connectorId,
            timestamp: new Date(mv.timestamp),
            sampledValue: mv.sampledValue as Array<Record<string, any>>
        }));

        if (samples.length) {
            connectionManager.recordMeterValues(chargePointId, samples);
        }

        if (AppDataSource.isInitialized) {
            const repo = AppDataSource.getRepository(MeterValue);
            for (const sample of samples) {
                await repo.save(repo.create({
                    transactionId: sample.transactionId,
                    connectorId: sample.connectorId,
                    timestamp: sample.timestamp,
                    sampledValue: sample.sampledValue
                }));
            }

            if (transactionId) {
                const txRepo = AppDataSource.getRepository(Transaction);
                const tx = await txRepo.findOneBy({ id: transactionId });
                const firstValue = samples[0]?.sampledValue?.[0]?.value;
                if (tx && firstValue !== undefined) {
                    tx.energy = Number(firstValue);
                    await txRepo.save(tx);
                }
            }
        } else {
            logger.debug(`[MeterValues] PostgreSQL disabled, stored ${samples.length} samples in memory for ${chargePointId}`);
        }

        const firstSample = samples[0]?.sampledValue?.[0];
        const valueText = firstSample?.value !== undefined ? `${firstSample.value}` : 'n/a';
        const unitText = firstSample?.unit ? ` ${firstSample.unit}` : '';
        const measurandText = firstSample?.measurand ? ` (${firstSample.measurand})` : '';
        logger.info(`Meter from ${chargePointId}: ${valueText}${unitText}${measurandText}`);
        return {};
    } catch (err) {
        logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}