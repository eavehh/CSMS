import WebSocket from 'ws';
import { logger } from '../logger';
import { ChargePoint } from '../db/mongoose';
import { Transaction } from "../db/entities/Transaction"

interface MeterValueSnapshot {
    timestamp: Date;
    connectorId: number;
    transactionId?: string;
    sampledValue: Array<Record<string, any>>;
}


export interface ConnectorState {
    status: string;
    transactionId?: string;
    errorCode?: string;
    lastUpdate: Date;
    reservationId?: number;
    reservedUntil?: Date;
}

export class ConnectionManager {
    private connections: Map<string, WebSocket> = new Map();
    private pendingRequests: Map<string, string> = new Map();  // по id сервер понимает какой action ответ пришел, uniqueId -> action
    private reverseConnections: Map<WebSocket, string> = new Map();
    private formats: Map<string, "json" | "binary"> = new Map();
    private connectorStates: Map<string, Map<number, ConnectorState>> = new Map();
    lastActivity: Map<string, number> = new Map();
    reservationCleanupInterval: NodeJS.Timeout | null = null;

    // 🔥 Простой массив транзакций в памяти (максимум 10)
    private recentTransactions: Array<any> = [];
    private readonly MAX_RECENT_TRANSACTIONS = 10;
    private meterValuesHistory: Map<string, MeterValueSnapshot[]> = new Map();
    private readonly MAX_METER_VALUE_SAMPLES = 100;

    constructor() {
        logger.info(`[ConnectionManager] Initialized with in-memory transaction storage (max ${this.MAX_RECENT_TRANSACTIONS})`);
    }

    /**
     * 🔥 Добавляет ЗАВЕРШЕННУЮ транзакцию в список недавних (только в памяти).
     * Вызывается ТОЛЬКО при stopTransaction с полными данными (start + stop).
     */
    addRecentTransaction(trx: any) {
        try {
            const transactionId = String(trx.transactionId);

            // Просто добавляем новую транзакцию в начало массива
            this.recentTransactions.unshift({
                ...trx,
                status: trx.status || 'Completed'
            });

            logger.info(`[ConnectionManager] Added completed transaction ${transactionId} to recent list`);

            // 🔥 Обрезаем до MAX_RECENT_TRANSACTIONS (10 элементов)
            if (this.recentTransactions.length > this.MAX_RECENT_TRANSACTIONS) {
                const removed = this.recentTransactions.splice(this.MAX_RECENT_TRANSACTIONS);
                logger.debug(`[ConnectionManager] Removed ${removed.length} oldest transactions`);
            }
        } catch (err) {
            logger.error(`[ConnectionManager] Error in addRecentTransaction: ${err}`);
        }
    }

    /**
     * 🔥 Возвращает последние N транзакций из памяти
     */
    getRecentTransactions(limit: number = 10): Array<any> {
        return this.recentTransactions.slice(0, limit);
    }

    /**
     * 🔥 Удаляет транзакцию по ID
     */
    removeRecentTransaction(transactionId: string): boolean {
        const before = this.recentTransactions.length;
        this.recentTransactions = this.recentTransactions.filter(
            t => String(t.transactionId) !== String(transactionId)
        );
        const removed = this.recentTransactions.length < before;
        if (removed) {
            logger.info(`[ConnectionManager] Removed transaction ${transactionId}`);
        }
        return removed;
    }

    /**
     * 🔥 Очищает все недавние транзакции из памяти
     */
    clearRecentTransactions(): number {
        const count = this.recentTransactions.length;
        this.recentTransactions = [];
        logger.info(`[ConnectionManager] Cleared ${count} recent transactions from memory`);
        return count;
    }

    /**
     * 🗑️ Удаляет конкретную транзакцию по ID из недавних транзакций
     */
    deleteRecentTransaction(transactionId: string | number): boolean {
        const initialLength = this.recentTransactions.length;

        // Приводим transactionId к строке для сравнения
        const idToDelete = transactionId.toString();

        this.recentTransactions = this.recentTransactions.filter(tx => {
            // Сравниваем как строки, чтобы избежать проблем с типами (string vs number)
            return tx.transactionId?.toString() !== idToDelete;
        });

        const deleted = this.recentTransactions.length < initialLength;

        if (deleted) {
            logger.info(`[ConnectionManager] Deleted transaction ${transactionId} from recent transactions`);
        } else {
            logger.warn(`[ConnectionManager] Transaction ${transactionId} not found in recent transactions`);
        }

        return deleted;
    }

    recordMeterValues(chargePointId: string, samples: MeterValueSnapshot[]): void {
        const history = this.meterValuesHistory.get(chargePointId) || [];
        for (const sample of samples) {
            history.unshift(sample);
        }
        if (history.length > this.MAX_METER_VALUE_SAMPLES) {
            history.splice(this.MAX_METER_VALUE_SAMPLES);
        }
        this.meterValuesHistory.set(chargePointId, history);
    }

    getRecentMeterValues(chargePointId: string, limit: number = 25): MeterValueSnapshot[] {
        const history = this.meterValuesHistory.get(chargePointId);
        if (!history) {
            return [];
        }
        return history.slice(0, limit);
    }


    updateLastActivity(chargePointId: string) {
        this.lastActivity.set(chargePointId, Date.now());
    }

    isActive(chargePointId: string, timeout = 24 * 60 * 60 * 1000) {
        const lstAct = this.lastActivity.get(chargePointId);
        return lstAct && (Date.now() - lstAct < timeout);
    }

    add(ws: WebSocket, chargePointId: string) {
        this.connections.set(chargePointId, ws);
        this.reverseConnections.set(ws, chargePointId);
        this.updateLastActivity(chargePointId);
        // 🔥 НЕ инициализируем дефолтные коннекторы - они будут созданы при StatusNotification
        // Это позволяет станциям самостоятельно сообщать о количестве коннекторов
        logger.info(`[AddConnection] Added connection for ${chargePointId} (connectors will be auto-initialized from StatusNotification)`);
    }

    remove(chargePointId: string) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
        // Удаляем состояния коннекторов при отключении станции
        this.connectorStates.delete(chargePointId);
        logger.info(`[ConnectionManager] Removed chargePointId ${chargePointId} and its connector states`);
    }

    // Отвязать только сокет, оставив состояние коннекторов нетронутым
    detachSocketOnly(chargePointId: string) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
    }

    get(chargePointId: string): WebSocket | undefined {
        return this.connections.get(chargePointId);
    }

    getAllConnections(): Map<string, WebSocket> | undefined {
        return this.connections;
    }

    getByWs(ws: WebSocket): string | undefined {
        return this.reverseConnections.get(ws);
    }

    setPendingRequest(uniqueId: string, action: string): void {
        this.pendingRequests.set(uniqueId, action);
        logger.info(`[ConnectionManager] Pending request set: ${uniqueId} → ${action}`);
    }

    getAndClearPendingRequest(uniqueId: string): string | undefined {
        const action = this.pendingRequests.get(uniqueId);
        this.pendingRequests.delete(uniqueId);
        logger.info(`[ConnectionManager] Pending request deleted: ${uniqueId} → ${action}`);

        return action;
    }

    setLastOffline(chargePointId: string, date: Date) {
        ChargePoint.findOneAndUpdate(
            { id: chargePointId },
            { lastOffline: date },
            { upsert: true }
        ).then(() => logger.info(`[Heartbeat] Set lastOffline for ${chargePointId}: ${date}`))
            .catch(err => logger.error(`[Heartbeat] Error set [lastOffline]: ${err}`));
        const ws = this.connections.get(chargePointId);
        if (ws) (ws as any).lastOffline = date;
    }

    setFormat(chargePointId: string, format: 'json' | 'binary') {
        this.formats.set(chargePointId, format);
    }

    getFormat(chargePointId: string) {
        return this.formats.get(chargePointId) || 'json';
    }


    getConnectorState(chargePointId: string, connectorId: number): ConnectorState | undefined {
        const states = this.connectorStates.get(chargePointId);
        return states ? states.get(connectorId) : undefined;
    }

    updateConnectorState(
        chargePointId: string,
        connectorId: number,
        status: string,
        transactionId?: string,
        errorCode?: string,
        reservationId?: number,
        expiryDate?: Date
    ): void {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map<number, ConnectorState>();
            this.connectorStates.set(chargePointId, states);
        }
        states.set(connectorId, {
            status,
            transactionId,
            errorCode,
            lastUpdate: new Date(),
            reservationId,
            reservedUntil: expiryDate
        });
        logger.info(`[UpdatedConnector] ${connectorId} for ${chargePointId}: ${status}${transactionId ? ` (transaction id: ${transactionId})` : ''}`);
        this.updateLastActivity(chargePointId);  // Обновляем активность станции
    }


    initializeConnectors(chargePointId: string, numConnectors: number = 1): void {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map<number, ConnectorState>();
            this.connectorStates.set(chargePointId, states);
        }
        for (let i = 1; i <= numConnectors; i++) {
            if (!states.has(i)) {
                states.set(i, { status: 'Available', lastUpdate: new Date() });
            }
        }
        logger.info(`[connectorManager] cinitializeConnectors: ${numConnectors} connectors for ${chargePointId}`);
    }

    getAllConnectors(chargePointId: string): Map<number, ConnectorState> | undefined {
        return this.connectorStates.get(chargePointId);
    }


    getAllChargePointsWithConnectors(): Map<string, Map<number, ConnectorState>> {
        return this.connectorStates;
    }

    cleanupExpiredReservations() {
        this.connectorStates.forEach((states, chargePointId) => {
            states.forEach((state, connectorId) => {
                if (state.status === 'Reserved' && state.reservedUntil && new Date() > state.reservedUntil) {
                    this.updateConnectorState(chargePointId, connectorId, 'Available');
                    logger.info(`Expired reservation cleared for connector ${connectorId} on ${chargePointId}`);
                }
            });
        });
    }
    async getTotalKWh(chargePointId: string, fromDate: Date, toDate: Date): Promise<number> {
        const repo = require('../db/postgres').AppDataSource.getRepository(Transaction);
        const result = await repo
            .createQueryBuilder('tx')
            .select('SUM(tx.totalKWh)', 'total')
            .where('tx.chargePointId = :chargePointId', { chargePointId })
            .andWhere('tx.stopTime >= :fromDate', { fromDate })
            .andWhere('tx.stopTime <= :toDate', { toDate })
            .getRawOne();
        return Number(result?.total) || 0;
    }
}
