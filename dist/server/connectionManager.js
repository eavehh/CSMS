"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const logger_1 = require("../logger");
const mongoose_1 = require("../db/mongoose");
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.formats = new Map();
    }
    add(ws, chargePointId) {
        this.connections.set(chargePointId, ws);
    }
    remove(chargePointId) {
        this.connections.delete(chargePointId);
    }
    get(chargePointId) {
        return this.connections.get(chargePointId);
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
