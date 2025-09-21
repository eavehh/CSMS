"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
class ConnectionManager {
    constructor() {
        this.connections = new Map();
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
}
exports.ConnectionManager = ConnectionManager;
