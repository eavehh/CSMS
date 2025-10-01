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
    }
    updateLastActivity(chargePointId) {
        this.lastActivity.set(chargePointId, Date.now());
    }
    isActive(chargePointId, timeout = bootNotification_1.INTERVAL * 1000) {
        const lstAct = this.lastActivity.get(chargePointId);
        return (lstAct && (timeout > Date.now() - lstAct));
    }
    add(ws, chargePointId) {
        this.connections.set(chargePointId, ws);
        this.reverseConnections.set(ws, chargePointId); // reverse
        this.updateLastActivity(chargePointId); // Если есть
    }
    remove(chargePointId) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws); // Удали reverse
        }
        this.connections.delete(chargePointId);
    }
    get(chargePointId) {
        return this.connections.get(chargePointId);
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
        return this.formats.get(chargePointId) || 'json'; //дефолт - json
    }
}
exports.ConnectionManager = ConnectionManager;
