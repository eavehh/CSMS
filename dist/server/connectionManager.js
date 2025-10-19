"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
const Transaction_1 = require("../db/entities/Transaction");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.pendingRequests = new Map(); // по id сервер понимает какой action ответ пришел, uniqueId -> action
        this.reverseConnections = new Map();
        this.formats = new Map();
        this.connectorStates = new Map();
        this.lastActivity = new Map();
        this.reservationCleanupInterval = null;
        this.recentTransactions = [];
        this.recentTransactionsFile = path.join(__dirname, '../../data/recentTransactions.json');
        // Загружаем сохраненные транзакции при старте
        this.loadRecentTransactions();
    }
    /**
     * Загружает транзакции из файла при старте сервера
     */
    loadRecentTransactions() {
        try {
            // Создаем директорию если не существует
            const dir = path.dirname(this.recentTransactionsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Загружаем данные из файла
            if (fs.existsSync(this.recentTransactionsFile)) {
                const data = fs.readFileSync(this.recentTransactionsFile, 'utf-8');
                this.recentTransactions = JSON.parse(data);
                logger_1.logger.info(`[ConnectionManager] Loaded ${this.recentTransactions.length} recent transactions from file`);
            }
            else {
                logger_1.logger.info(`[ConnectionManager] No saved transactions file found, starting fresh`);
            }
        }
        catch (err) {
            logger_1.logger.error(`[ConnectionManager] Error loading recent transactions: ${err}`);
            this.recentTransactions = [];
        }
    }
    /**
     * Сохраняет транзакции в файл
     */
    saveRecentTransactions() {
        try {
            const dir = path.dirname(this.recentTransactionsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.recentTransactionsFile, JSON.stringify(this.recentTransactions, null, 2));
            logger_1.logger.debug(`[ConnectionManager] Saved ${this.recentTransactions.length} transactions to file`);
        }
        catch (err) {
            logger_1.logger.error(`[ConnectionManager] Error saving recent transactions: ${err}`);
        }
    }
    /**
     * Добавляет или обновляет транзакцию в списке недавних.
     * При первом вызове (start) создается новая запись.
     * При втором вызове (stop) с тем же transactionId - дополняет существующую запись.
     */
    addRecentTransaction(trx) {
        try {
            const transactionId = String(trx.transactionId);
            const existingIndex = this.recentTransactions.findIndex(t => String(t.transactionId) === transactionId);
            if (existingIndex !== -1) {
                // Транзакция уже существует - дополняем её данными остановки
                const existing = this.recentTransactions[existingIndex];
                this.recentTransactions[existingIndex] = {
                    ...existing,
                    ...trx,
                    // Сохраняем startTime из первой записи, если он там был
                    startTime: existing.startTime || trx.startTime,
                    // Обновляем статус
                    status: trx.status === 'Stopped' ? 'Completed' : trx.status
                };
                logger_1.logger.info(`[ConnectionManager] Updated transaction ${transactionId} with stop data`);
            }
            else {
                // Новая транзакция - добавляем в начало
                this.recentTransactions.unshift({
                    ...trx,
                    status: trx.status || 'Started'
                });
                logger_1.logger.info(`[ConnectionManager] Added new transaction ${transactionId}`);
            }
            // Обрезаем до 30 последних
            if (this.recentTransactions.length > 30) {
                this.recentTransactions.length = 30;
            }
            // Сохраняем в файл после каждого изменения
            this.saveRecentTransactions();
        }
        catch (err) {
            logger_1.logger.error(`[ConnectionManager] Error in addRecentTransaction: ${err}`);
        }
    }
    /**
     * Возвращает последние N транзакций
     */
    getRecentTransactions(limit = 30) {
        return this.recentTransactions.slice(0, limit);
    }
    removeRecentTransaction(transactionId) {
        const before = this.recentTransactions.length;
        this.recentTransactions = this.recentTransactions.filter(t => String(t.transactionId) !== String(transactionId));
        return this.recentTransactions.length < before;
    }
    /**
     * Очищает все недавние транзакции из памяти и файла
     */
    clearRecentTransactions() {
        const count = this.recentTransactions.length;
        this.recentTransactions = [];
        this.saveRecentTransactions(); // Сохраняем пустой массив в файл
        logger_1.logger.info(`[ConnectionManager] Cleared ${count} recent transactions from memory and file`);
        return count;
    }
    updateLastActivity(chargePointId) {
        this.lastActivity.set(chargePointId, Date.now());
    }
    isActive(chargePointId, timeout = 24 * 60 * 60 * 1000) {
        const lstAct = this.lastActivity.get(chargePointId);
        return lstAct && (Date.now() - lstAct < timeout);
    }
    add(ws, chargePointId) {
        this.connections.set(chargePointId, ws);
        this.reverseConnections.set(ws, chargePointId);
        this.updateLastActivity(chargePointId);
        // Новое: Инициализируем состояния коннекторов (дефолт: 1 коннектор, 'Available')
        if (!this.connectorStates.has(chargePointId)) {
            const defaultConnectors = new Map();
            defaultConnectors.set(1, { status: 'Available', lastUpdate: new Date() });
            this.connectorStates.set(chargePointId, defaultConnectors);
            logger_1.logger.info(`[AddConnection] Initialized default connector states for ${chargePointId}`);
        }
    }
    remove(chargePointId) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
        // Удаляем состояния коннекторов при отключении станции
        this.connectorStates.delete(chargePointId);
        logger_1.logger.info(`[ConnectionManager] Removed chargePointId ${chargePointId} and its connector states`);
    }
    // Отвязать только сокет, оставив состояние коннекторов нетронутым
    detachSocketOnly(chargePointId) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
    }
    get(chargePointId) {
        return this.connections.get(chargePointId);
    }
    getAllConnections() {
        return this.connections;
    }
    getByWs(ws) {
        return this.reverseConnections.get(ws);
    }
    setPendingRequest(uniqueId, action) {
        this.pendingRequests.set(uniqueId, action);
        logger_1.logger.info(`[ConnectionManager] Pending request set: ${uniqueId} → ${action}`);
    }
    getAndClearPendingRequest(uniqueId) {
        const action = this.pendingRequests.get(uniqueId);
        this.pendingRequests.delete(uniqueId);
        logger_1.logger.info(`[ConnectionManager] Pending request deleted: ${uniqueId} → ${action}`);
        return action;
    }
    setLastOffline(chargePointId, date) {
        mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, { lastOffline: date }, { upsert: true }).then(() => logger_1.logger.info(`[Heartbeat] Set lastOffline for ${chargePointId}: ${date}`))
            .catch(err => logger_1.logger.error(`[Heartbeat] Error set [lastOffline]: ${err}`));
        const ws = this.connections.get(chargePointId);
        if (ws)
            ws.lastOffline = date;
    }
    setFormat(chargePointId, format) {
        this.formats.set(chargePointId, format);
    }
    getFormat(chargePointId) {
        return this.formats.get(chargePointId) || 'json';
    }
    getConnectorState(chargePointId, connectorId) {
        const states = this.connectorStates.get(chargePointId);
        return states ? states.get(connectorId) : undefined;
    }
    updateConnectorState(chargePointId, connectorId, status, transactionId, errorCode, reservationId, expiryDate) {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map();
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
        logger_1.logger.info(`[UpdatedConnector] ${connectorId} for ${chargePointId}: ${status}${transactionId ? ` (transaction id: ${transactionId})` : ''}`);
        this.updateLastActivity(chargePointId); // Обновляем активность станции
    }
    initializeConnectors(chargePointId, numConnectors = 1) {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map();
            this.connectorStates.set(chargePointId, states);
        }
        for (let i = 1; i <= numConnectors; i++) {
            if (!states.has(i)) {
                states.set(i, { status: 'Available', lastUpdate: new Date() });
            }
        }
        logger_1.logger.info(`[connectorManager] cinitializeConnectors: ${numConnectors} connectors for ${chargePointId}`);
    }
    getAllConnectors(chargePointId) {
        return this.connectorStates.get(chargePointId);
    }
    getAllChargePointsWithConnectors() {
        return this.connectorStates;
    }
    cleanupExpiredReservations() {
        this.connectorStates.forEach((states, chargePointId) => {
            states.forEach((state, connectorId) => {
                if (state.status === 'Reserved' && state.reservedUntil && new Date() > state.reservedUntil) {
                    this.updateConnectorState(chargePointId, connectorId, 'Available');
                    logger_1.logger.info(`Expired reservation cleared for connector ${connectorId} on ${chargePointId}`);
                }
            });
        });
    }
    async getTotalKWh(chargePointId, fromDate, toDate) {
        const repo = require('../db/postgres').AppDataSource.getRepository(Transaction_1.Transaction);
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
exports.ConnectionManager = ConnectionManager;
