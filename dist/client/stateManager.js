"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargePointManager = exports.ChargePointState = void 0;
const logger_1 = require("../logger");
class ChargePointState {
    constructor(connectorId = 1) {
        this.status = 'Available';
        this.currentTransaction = null;
        this.meterValue = 0;
        this.lastStatusUpdate = new Date();
        this.connectorId = connectorId;
    }
    updateStatus(newStatus, errorCode = 'NoError') {
        const oldStatus = this.status;
        this.status = newStatus;
        this.lastStatusUpdate = new Date();
        logger_1.logger.info(`ChargePoint status changed from ${oldStatus} to ${newStatus}`);
        // Логика для разных состояний
        switch (newStatus) {
            case 'Available':
                this.handleAvailableState();
                break;
            case 'Preparing':
                this.handlePreparingState();
                break;
            case 'Charging':
                this.handleChargingState();
                break;
            case 'Finishing':
                this.handleFinishingState();
                break;
            case 'Faulted':
                this.handleFaultedState(errorCode);
                break;
            case 'Unavailable':
                this.handleUnavailableState();
                break;
        }
    }
    startTransaction(transactionId) {
        if (this.status === 'Available' || this.status === 'Preparing') {
            this.currentTransaction = transactionId;
            this.updateStatus('Charging');
            logger_1.logger.info(`Transaction ${transactionId} started successfully`);
        }
        else {
            logger_1.logger.error(`Cannot start transaction ${transactionId}: ChargePoint is in ${this.status} state`);
        }
    }
    stopTransaction() {
        if (this.currentTransaction !== null) {
            const transactionId = this.currentTransaction;
            this.currentTransaction = null;
            this.updateStatus('Finishing');
            logger_1.logger.info(`Transaction ${transactionId} stopped successfully`);
        }
        else {
            logger_1.logger.error('No active transaction to stop');
        }
    }
    updateMeterValue(value) {
        this.meterValue = value;
        logger_1.logger.info(`Meter value updated: ${value} Wh`);
    }
    getStatus() {
        return this.status;
    }
    getCurrentTransaction() {
        return this.currentTransaction;
    }
    getMeterValue() {
        return this.meterValue;
    }
    getConnectorId() {
        return this.connectorId;
    }
    getLastStatusUpdate() {
        return this.lastStatusUpdate;
    }
    isAvailable() {
        return this.status === 'Available' && this.currentTransaction === null;
    }
    isCharging() {
        return this.status === 'Charging' && this.currentTransaction !== null;
    }
    handleAvailableState() {
        // Станция готова к использованию
        logger_1.logger.info('ChargePoint is available for charging');
    }
    handlePreparingState() {
        // Подготовка к зарядке (подключение кабеля и т.д.)
        logger_1.logger.info('ChargePoint is preparing for charging');
    }
    handleChargingState() {
        // Активная зарядка
        logger_1.logger.info(`Charging in progress for transaction ${this.currentTransaction}`);
        // Здесь можно добавить логику для периодической отправки MeterValues
        // Например, каждые 60 секунд во время зарядки
    }
    handleFinishingState() {
        // Завершение зарядки
        logger_1.logger.info('Finishing charging session');
        // Автоматический переход в Available через 30 секунд
        setTimeout(() => {
            if (this.status === 'Finishing') {
                this.updateStatus('Available');
            }
        }, 30000);
    }
    handleFaultedState(errorCode) {
        // Обработка ошибки
        logger_1.logger.error(`ChargePoint faulted with error code: ${errorCode}`);
        // Здесь можно добавить логику для:
        // - Отправки уведомлений администратору
        // - Логирования ошибки в базу данных
        // - Попытки автоматического восстановления
    }
    handleUnavailableState() {
        // Станция недоступна
        logger_1.logger.info('ChargePoint is unavailable');
    }
    getStateSummary() {
        return {
            status: this.status,
            currentTransaction: this.currentTransaction,
            meterValue: this.meterValue,
            connectorId: this.connectorId,
            lastStatusUpdate: this.lastStatusUpdate,
            isAvailable: this.isAvailable(),
            isCharging: this.isCharging()
        };
    }
}
exports.ChargePointState = ChargePointState;
// Менеджер для управления несколькими коннекторами
class ChargePointManager {
    constructor(chargePointId) {
        this.connectors = new Map();
        this.chargePointId = chargePointId;
        // По умолчанию создаем один коннектор
        this.connectors.set(1, new ChargePointState(1));
    }
    addConnector(connectorId) {
        if (!this.connectors.has(connectorId)) {
            this.connectors.set(connectorId, new ChargePointState(connectorId));
            logger_1.logger.info(`Added connector ${connectorId} to charge point ${this.chargePointId}`);
        }
    }
    getConnector(connectorId) {
        return this.connectors.get(connectorId);
    }
    getAllConnectors() {
        return Array.from(this.connectors.values());
    }
    getChargePointId() {
        return this.chargePointId;
    }
    getAvailableConnector() {
        for (const connector of this.connectors.values()) {
            if (connector.isAvailable()) {
                return connector;
            }
        }
        return null;
    }
    getChargingConnectors() {
        return Array.from(this.connectors.values()).filter(connector => connector.isCharging());
    }
}
exports.ChargePointManager = ChargePointManager;
