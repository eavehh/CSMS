// connectionManager.ts (ClientManager + ChargePointManager merged, simpler)
import { logger } from '../logger';
import { ChargePointStatus } from '../utils/baseTypes';


export class ClientManager {
  private format: 'json' | 'binary' = 'json';
  private lastSentTime = 0;
  private interval = 60;
  private chargePointId: string;
  private connectors: Map<number, ChargePointState> = new Map();  // Map connectorId → state

  constructor(chargePointId: string = 'CP_001') {
    this.chargePointId = chargePointId;
    this.connectors.set(1, new ChargePointState(1));  // Default connector
  }

  setFormat(format: 'json' | 'binary') {
    this.format = format;
  }

  getFormat() {
    return this.format;
  }

  updateInterval(newInterval: number) {
    this.interval = newInterval;
  }

  updateLastSentTime() {
    this.lastSentTime = Date.now();
  }

  shouldSendHeartbeat(): boolean {
    const timePassed = Date.now() - this.lastSentTime;
    return timePassed >= this.interval * 1000;
  }

  getChargePointId(): string {
    return this.chargePointId;
  }

  addConnector(connectorId: number) {
    if (!this.connectors.has(connectorId)) {
      this.connectors.set(connectorId, new ChargePointState(connectorId));
      logger.info(`Added connector ${connectorId} to ${this.chargePointId}`);
    }
  }

  getConnector(connectorId: number): ChargePointState | undefined {
    return this.connectors.get(connectorId);
  }

  getAllConnectors(): ChargePointState[] {
    return Array.from(this.connectors.values());
  }

  getAvailableConnector(): ChargePointState | null {
    return this.getAllConnectors().find(c => c.isAvailable()) || null;
  }

  getChargingConnectors(): ChargePointState[] {
    return this.getAllConnectors().filter(c => c.isCharging());
  }

  getState(connectorId: number = 1): ChargePointState {
    return this.getConnector(connectorId) || this.connectors.get(1)!;
  }
}


export class ChargePointState {
  status: ChargePointStatus = 'Available';
  private currentTransaction: number | null = null;
  private connectorId: number;
  private meterValue: number = 0;
  private lastStatusUpdate: Date = new Date();

  constructor(connectorId: number = 1) {
    this.connectorId = connectorId;
  }

  updateStatus(newStatus: ChargePointStatus, errorCode: string = 'NoError') {
    const oldStatus = this.status;
    this.status = newStatus;
    this.lastStatusUpdate = new Date();

    logger.info(`Connector ${this.connectorId} status changed from ${oldStatus} to ${newStatus}`);

    // Упрощённая логика (убрал private handle*, добавил setTimeout только для Finishing)
    if (newStatus === 'Finishing') {
      setTimeout(() => {
        if (this.status === 'Finishing') {
          this.status = 'Available';
          logger.info(`Connector ${this.connectorId} back to Available`);
        }
      }, 30000);
    } else if (newStatus === 'Faulted') {
      logger.error(`Connector ${this.connectorId} faulted: ${errorCode}`);
    }
  }

  startTransaction(transactionId: number) {
    if (this.status === 'Available' || this.status === 'Preparing') {
      this.currentTransaction = transactionId;
      this.updateStatus('Charging');
      logger.info(`Transaction ${transactionId} started on connector ${this.connectorId}`);
    } else {
      logger.error(`Cannot start tx ${transactionId} on ${this.connectorId}: status ${this.status}`);
    }
  }

  stopTransaction() {
    if (this.currentTransaction !== null) {
      const txId = this.currentTransaction;
      this.currentTransaction = null;
      this.updateStatus('Finishing');
      logger.info(`Transaction ${txId} stopped on connector ${this.connectorId}`);
    } else {
      logger.error(`No tx to stop on connector ${this.connectorId}`);
    }
  }

  updateMeterValue(value: number) {
    this.meterValue = value;
    logger.info(`Meter updated on ${this.connectorId}: ${value} Wh`);
  }

  getStatus(): ChargePointStatus {
    return this.status;
  }

  getCurrentTransaction(): number | null {
    return this.currentTransaction;
  }

  getMeterValue(): number {
    return this.meterValue;
  }

  getConnectorId(): number {
    return this.connectorId;
  }

  getLastStatusUpdate(): Date {
    return this.lastStatusUpdate;
  }

  isAvailable(): boolean {
    return this.status === 'Available' && this.currentTransaction === null;
  }

  isCharging(): boolean {
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