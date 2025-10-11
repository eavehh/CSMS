"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTransaction = handleStopTransaction;
const mongoose_1 = require("../../db/mongoose");
const mongoose_2 = require("../../db/mongoose");
const logger_1 = require("../../logger");
const index_1 = require("../../server/index");
async function handleStopTransaction(req, chargePointId, ws) {
    try {
        // Проверка авторизации ID-тега (опционально; стандарт OCPP)
        const idTagStatus = req.idTag ? 'Accepted' : 'Accepted';
        const tx = await mongoose_1.Transaction.findOneAndUpdate({ id: req.transactionId.toString() }, // Приводим к строке, если модель ожидает string
        {
            stopTime: new Date(req.timestamp),
            meterStop: req.meterStop,
            reason: req.reason, // Опциональное
            transactionData: req.transactionData || [], // Опциональное, с дефолтом
            idTag: req.idTag || null // Опциональное, для записи ID-тега остановки
        }, { new: true });
        if (!tx) {
            logger_1.logger.error(`Tx not found: ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        // Расчёт счётчиков (после обновления tx)
        const totalWh = (req.meterStop || 0) - (tx.meterStart || 0); // В Wh
        const totalKWh = totalWh / 1000; // Преобразование в kWh
        const cost = totalKWh * (tx.tariffPerKWh || 0.1); // Сумма (настраиваемый тариф)
        const sessionDurationMinutes = (new Date(req.timestamp).getTime() - tx.startTime.getTime()) / (1000 * 60); // Длительность сессии
        const maxPossibleKWh = sessionDurationMinutes * 0.05; // Пример: 3 kW мощность = 0.05 kWh/мин (настройте по конфигурации)
        const efficiencyPercentage = maxPossibleKWh > 0 ? (totalKWh / maxPossibleKWh) * 100 : 0; // Процент (0–100)
        // Обновляем транзакцию с расчётами
        tx.totalKWh = totalKWh;
        tx.cost = cost;
        tx.efficiencyPercentage = efficiencyPercentage;
        await tx.save();
        await mongoose_2.Log.create({ action: 'StopTransaction', chargePointId, payload: { ...req, totalKWh, cost, efficiencyPercentage } });
        // Обновляем состояние коннектора: извлекаем connectorId из найденной транзакции
        const connectorId = tx.connectorId; // Из модели Transaction (сохранено в StartTransaction)
        if (!connectorId) {
            logger_1.logger.error(`[StopTransaction] No connectorId found for tx ${req.transactionId}`);
            return { idTagInfo: { status: 'Invalid' } };
        }
        // Проверяем текущее состояние коннектора (опционально, для безопасности)
        const currentState = index_1.connectionManager.getConnectorState(chargePointId, connectorId);
        if (currentState && currentState.status !== 'Charging') {
            logger_1.logger.warn(`[StopTransaction] for non-charging connector ${connectorId} on ${chargePointId}`);
        }
        index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Finishing');
        // Индивидуальный таймаут: Сброс только этого коннектора в 'Available' через 2 секунды
        setTimeout(() => {
            index_1.connectionManager.updateConnectorState(chargePointId, connectorId, 'Available');
            logger_1.logger.info(`[StopTransaction] Connector ${connectorId} on ${chargePointId} reset to Available after Finishing`);
        }, 2000); // Стандартный таймаут по OCPP (1–5 секунд)
        logger_1.logger.info(`[StopTransaction] Stop tx from ${chargePointId}: id ${req.transactionId}, totalKWh=${totalKWh.toFixed(2)}, cost=${cost.toFixed(2)} EUR, efficiency=${efficiencyPercentage.toFixed(1)}%, reason: ${req.reason || 'Local'}, connector: ${connectorId}`);
        return { idTagInfo: { status: idTagStatus } };
    }
    catch (err) {
        logger_1.logger.error(`Error in StopTransaction: ${err}`);
        return { idTagInfo: { status: 'Blocked' } };
    }
}
