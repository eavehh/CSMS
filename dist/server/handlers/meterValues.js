"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMeterValues = handleMeterValues;
const postgres_1 = require("../../db/postgres");
const MeterValue_1 = require("../../db/entities/MeterValue");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
async function handleMeterValues(req, chargePointId, ws) {
    try {
        // Сохраняем MeterValue (отдельная таблица)
        const repo = postgres_1.AppDataSource.getRepository(MeterValue_1.MeterValue);
        for (const mv of req.meterValue) {
            await repo.save(repo.create({
                transactionId: req.transactionId.toString(),
                connectorId: req.connectorId,
                timestamp: new Date(mv.timestamp),
                sampledValue: mv.sampledValue
            }));
        }
        // Можно обновить энергию в транзакции, если требуется
        if (req.transactionId) {
            const txRepo = postgres_1.AppDataSource.getRepository(Transaction_1.Transaction);
            const tx = await txRepo.findOneBy({ id: req.transactionId?.toString() });
            if (tx && req.meterValue[0]?.sampledValue[0]?.value) {
                tx.energy = Number(req.meterValue[0].sampledValue[0].value);
                await txRepo.save(tx);
            }
        }
        logger_1.logger.info(`Meter from ${chargePointId}: ${req.meterValue[0]?.sampledValue[0]?.value} kWh`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}
