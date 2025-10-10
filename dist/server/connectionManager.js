"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.pendingRequests = new Map(); // по id сервер понимает какой action ответ пришел, uniqueId -> action
        this.reverseConnections = new Map();
        this.formats = new Map();
        this.connectorStates = new Map();
        this.lastActivity = new Map();
        this.reservationCleanupInterval = null;
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
}
exports.ConnectionManager = ConnectionManager;
