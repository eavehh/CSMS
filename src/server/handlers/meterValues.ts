import { MeterValuesRequest } from '../types/1.6/MeterValues';
import { MeterValuesResponse } from '../types/1.6/MeterValuesResponse';
import { AppDataSource } from '../../db/postgres'
import { MeterValue } from '../../db/entities/MeterValue';
import { Transaction } from '../../db/entities/Transaction';
import { logger } from '../../logger';
import WebSocket from 'ws';

export async function handleMeterValues(req: MeterValuesRequest, chargePointId: string, ws: WebSocket): Promise<MeterValuesResponse> {
    try {
        // Сохраняем MeterValue (отдельная таблица)
        const repo = AppDataSource.getRepository(MeterValue);
        for (const mv of req.meterValue) {
            await repo.save(repo.create({
                transactionId: (req.transactionId as any).toString(),
                connectorId: req.connectorId,
                timestamp: new Date(mv.timestamp),
                sampledValue: mv.sampledValue
            }));
        }

        // Можно обновить энергию в транзакции, если требуется
        if (req.transactionId) {
            const txRepo = AppDataSource.getRepository(Transaction);
            const tx = await txRepo.findOneBy({ id: req.transactionId?.toString() });
            if (tx && req.meterValue[0]?.sampledValue[0]?.value) {
                tx.energy = Number(req.meterValue[0].sampledValue[0].value);
                await txRepo.save(tx);
            }
        }

        logger.info(`Meter from ${chargePointId}: ${req.meterValue[0]?.sampledValue[0]?.value} kWh`);
        return {};
    } catch (err) {
        logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}