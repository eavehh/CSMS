"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
const bootNotification_1 = require("./handlers/bootNotification");
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.reverseConnections = new Map();
        this.formats = new Map();
        this.lastActivity = new Map();
        // Новое: Хранение состояний коннекторов (chargePointId -> Map<connectorId, ConnectorState>)
        this.connectorStates = new Map();
    }
    updateLastActivity(chargePointId) {
        this.lastActivity.set(chargePointId, Date.now());
    }
    isActive(chargePointId, timeout = bootNotification_1.INTERVAL * 1000) {
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
            logger_1.logger.info(`Initialized default connector states for ${chargePointId}`);
        }
    }
    remove(chargePointId) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
        // Новое: Очищаем состояния коннекторов
        this.connectorStates.delete(chargePointId);
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
    setLastOffline(chargePointId, date) {
        mongoose_1.ChargePoint.findOneAndUpdate({ id: chargePointId }, { lastOffline: date }, { upsert: true }).then(() => logger_1.logger.info(`Set lastOffline for ${chargePointId}: ${date}`))
            .catch(err => logger_1.logger.error(`Error set lastOffline: ${err}`));
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
    // Новые методы для коннекторов
    /**
     * Получить состояние коннектора
     * @param chargePointId ID станции
     * @param connectorId ID коннектора (1-based)
     */
    getConnectorState(chargePointId, connectorId) {
        const states = this.connectorStates.get(chargePointId);
        return states ? states.get(connectorId) : undefined;
    }
    /**
     * Обновить состояние коннектора (например, из StatusNotification)
     * @param chargePointId ID станции
     * @param connectorId ID коннектора
     * @param status Новый статус
     * @param transactionId Опционально, для транзакций
     * @param errorCode Опционально, код ошибки
     */
    updateConnectorState(chargePointId, connectorId, status, transactionId, errorCode) {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map();
            this.connectorStates.set(chargePointId, states);
        }
        states.set(connectorId, {
            status,
            transactionId,
            errorCode,
            lastUpdate: new Date()
        });
        logger_1.logger.info(`Updated connector ${connectorId} for ${chargePointId}: ${status}${transactionId ? ` (tx: ${transactionId})` : ''}`);
        this.updateLastActivity(chargePointId); // Обновляем активность станции
    }
    /**
     * Инициализировать несколько коннекторов (вызывать после BootNotification, на основе конфигурации)
     * @param chargePointId ID станции
     * @param numConnectors Количество коннекторов (из GetConfiguration или дефолт)
     */
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
        logger_1.logger.info(`Initialized ${numConnectors} connectors for ${chargePointId}`);
    }
    /**
     * Получить все коннекторы станции
     * @param chargePointId ID станции
     */
    getAllConnectors(chargePointId) {
        return this.connectorStates.get(chargePointId);
    }
    /**
     * Получить все станции с коннекторами
     */
    getAllChargePointsWithConnectors() {
        return this.connectorStates;
    }
    // Новое: Метод для интерлока (опционально: установить 'Unavailable' для всех кроме выбранного)
    setInterlockUnavailable(chargePointId, activeConnectorId) {
        const states = this.connectorStates.get(chargePointId);
        if (states) {
            states.forEach((state, connectorId) => {
                if (connectorId !== activeConnectorId) {
                    this.updateConnectorState(chargePointId, connectorId, 'Unavailable');
                }
            });
        }
    }
    // Новое: Сброс всех коннекторов в 'Available' (после StopTransaction)
    resetAllConnectorsToAvailable(chargePointId) {
        const states = this.connectorStates.get(chargePointId);
        if (states) {
            states.forEach((_, connectorId) => {
                this.updateConnectorState(chargePointId, connectorId, 'Available');
            });
        }
    }
}
exports.ConnectionManager = ConnectionManager;
