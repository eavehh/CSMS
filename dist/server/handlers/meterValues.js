"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMeterValues = handleMeterValues;
const postgres_1 = require("../../db/postgres");
const MeterValue_1 = require("../../db/entities/MeterValue");
const Transaction_1 = require("../../db/entities/Transaction");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
// In-memory last energy per (stationId, connectorId, transactionId) to compute delta
const lastEnergyMap = new Map();
let lastBroadcastTs = 0; // global throttling per station; can refine later
const MIN_DELTA_BROADCAST_INTERVAL_MS = Number(process.env.METER_VALUES_DELTA_INTERVAL_MS || 2000);
async function handleMeterValues(req, chargePointId, ws) {
    try {
        // 🔥 FULL DEBUG: Dump complete structure
        logger_1.logger.info(`[MeterValues:FULL_DUMP] from ${chargePointId}:`);
        logger_1.logger.info(`[MeterValues:FULL_DUMP] ${JSON.stringify(req, null, 2)}`);
        logger_1.logger.info(`[MeterValues:KEYS] Available keys: ${Object.keys(req).join(', ')}`);
        // Tolerant parsing - accept any structure
        const transactionId = req.transactionId ? req.transactionId.toString() : undefined;
        const connectorId = req.connectorId || 0; // Support both standard meterValue array and any variations
        const meterValueArray = req.meterValue || req.meterValues || req.values || [];
        const samples = meterValueArray.map((mv) => {
            // Flexible timestamp parsing
            let timestamp;
            try {
                timestamp = mv.timestamp ? new Date(mv.timestamp) : new Date();
            }
            catch {
                timestamp = new Date();
            }
            // Flexible sampledValue parsing - accept any structure
            let sampledValue = [];
            if (Array.isArray(mv.sampledValue)) {
                sampledValue = mv.sampledValue;
            }
            else if (Array.isArray(mv.sampled_value)) {
                sampledValue = mv.sampled_value;
            }
            else if (mv.value !== undefined) {
                // Single value case (non-standard but tolerate)
                sampledValue = [{ value: String(mv.value), unit: mv.unit, measurand: mv.measurand }];
            }
            else if (typeof mv === 'object' && mv !== null) {
                // Any object with value-like fields
                sampledValue = [mv];
            }
            return {
                transactionId,
                connectorId,
                timestamp,
                sampledValue
            };
        });
        if (samples.length) {
            index_1.connectionManager.recordMeterValues(chargePointId, samples);
            // Delta computation & broadcast (throttled)
            try {
                const primary = samples[0]?.sampledValue?.find((v) => v.measurand === 'Energy.Active.Import.Register' || v.measurand === 'Energy.Active.Import.Interval' || v.value !== undefined);
                if (primary) {
                    const rawValue = Number(primary.value);
                    if (!Number.isNaN(rawValue)) {
                        const key = `${chargePointId}|${req.connectorId}|${transactionId || 'none'}`;
                        const prev = lastEnergyMap.get(key) || rawValue; // if no prev, delta 0
                        const delta = rawValue - prev;
                        lastEnergyMap.set(key, rawValue);
                        const now = Date.now();
                        if (delta !== 0 && (now - lastBroadcastTs) >= MIN_DELTA_BROADCAST_INTERVAL_MS) {
                            lastBroadcastTs = now;
                            index_1.connectionManager.broadcastEvent('meter.values.delta', {
                                stationId: chargePointId,
                                connectorId: req.connectorId,
                                transactionId: transactionId,
                                total: rawValue,
                                delta,
                                measurand: primary.measurand || 'Energy',
                                unit: primary.unit || 'Wh'
                            });
                        }
                    }
                }
            }
            catch (e) {
                logger_1.logger.warn(`[MeterValues] Delta computation failed: ${e}`);
            }
        }
        if (postgres_1.AppDataSource.isInitialized) {
            const repo = postgres_1.AppDataSource.getRepository(MeterValue_1.MeterValue);
            for (const sample of samples) {
                await repo.save(repo.create({
                    transactionId: sample.transactionId,
                    connectorId: sample.connectorId,
                    timestamp: sample.timestamp,
                    sampledValue: sample.sampledValue
                }));
            }
            if (transactionId) {
                const txRepo = postgres_1.AppDataSource.getRepository(Transaction_1.Transaction);
                const tx = await txRepo.findOneBy({ id: transactionId });
                const firstValue = samples[0]?.sampledValue?.[0]?.value;
                if (tx && firstValue !== undefined) {
                    tx.energy = Number(firstValue);
                    await txRepo.save(tx);
                }
            }
        }
        else {
            logger_1.logger.debug(`[MeterValues] PostgreSQL disabled, stored ${samples.length} samples in memory for ${chargePointId}`);
        }
        const firstSample = samples[0]?.sampledValue?.[0];
        const valueText = firstSample?.value !== undefined ? `${firstSample.value}` : 'n/a';
        const unitText = firstSample?.unit ? ` ${firstSample.unit}` : '';
        const measurandText = firstSample?.measurand ? ` (${firstSample.measurand})` : '';
        logger_1.logger.info(`Meter from ${chargePointId}: ${valueText}${unitText}${measurandText}`);
        return {};
    }
    catch (err) {
        logger_1.logger.error(`Error in MeterValues: ${err}`);
        return {};
    }
}
