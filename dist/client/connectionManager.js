"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargePointState = exports.ClientManager = void 0;
// connectionManager.ts (ClientManager + ChargePointManager merged, simpler)
const logger_1 = require("../logger");
class ClientManager {
    constructor(chargePointId = 'CP_001') {
        this.format = 'json';
        this.lastSentTime = 0;
        this.interval = 60;
        this.connectors = new Map(); // Map connectorId → state
        this.chargePointId = chargePointId;
        this.connectors.set(1, new ChargePointState(1)); // Default connector
    }
    setFormat(format) {
        this.format = format;
    }
    getFormat() {
        return this.format;
    }
    updateInterval(newInterval) {
        this.interval = newInterval;
    }
    updateLastSentTime() {
        this.lastSentTime = Date.now();
    }
    shouldSendHeartbeat() {
        const timePassed = Date.now() - this.lastSentTime;
        return timePassed >= this.interval * 1000;
    }
    getChargePointId() {
        return this.chargePointId;
    }
    addConnector(connectorId) {
        if (!this.connectors.has(connectorId)) {
            this.connectors.set(connectorId, new ChargePointState(connectorId));
            logger_1.logger.info(`Added connector ${connectorId} to ${this.chargePointId}`);
        }
    }
    getConnector(connectorId) {
        return this.connectors.get(connectorId);
    }
    getAllConnectors() {
        return Array.from(this.connectors.values());
    }
    getAvailableConnector() {
        return this.getAllConnectors().find(c => c.isAvailable()) || null;
    }
    getChargingConnectors() {
        return this.getAllConnectors().filter(c => c.isCharging());
    }
    getState(connectorId = 1) {
        return this.getConnector(connectorId) || this.connectors.get(1);
    }
}
exports.ClientManager = ClientManager;
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
        logger_1.logger.info(`Connector ${this.connectorId} status changed from ${oldStatus} to ${newStatus}`);
        // Упрощённая логика (убрал private handle*, добавил setTimeout только для Finishing)
        if (newStatus === 'Finishing') {
            setTimeout(() => {
                if (this.status === 'Finishing') {
                    this.status = 'Available';
                    logger_1.logger.info(`Connector ${this.connectorId} back to Available`);
                }
            }, 30000);
        }
        else if (newStatus === 'Faulted') {
            logger_1.logger.error(`Connector ${this.connectorId} faulted: ${errorCode}`);
        }
    }
    startTransaction(transactionId) {
        if (this.status === 'Available' || this.status === 'Preparing') {
            this.currentTransaction = transactionId;
            this.updateStatus('Charging');
            logger_1.logger.info(`Transaction ${transactionId} started on connector ${this.connectorId}`);
        }
        else {
            logger_1.logger.error(`Cannot start tx ${transactionId} on ${this.connectorId}: status ${this.status}`);
        }
    }
    stopTransaction() {
        if (this.currentTransaction !== null) {
            const txId = this.currentTransaction;
            this.currentTransaction = null;
            this.updateStatus('Finishing');
            logger_1.logger.info(`Transaction ${txId} stopped on connector ${this.connectorId}`);
        }
        else {
            logger_1.logger.error(`No tx to stop on connector ${this.connectorId}`);
        }
    }
    updateMeterValue(value) {
        this.meterValue = value;
        logger_1.logger.info(`Meter updated on ${this.connectorId}: ${value} Wh`);
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
