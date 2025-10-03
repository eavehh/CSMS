import WebSocket from 'ws';
import { logger } from '../logger';
import { ChargePoint } from '../db/mongoose'
import { INTERVAL } from './handlers/bootNotification'

export class ConnectionManager {
    private connections: Map<string, WebSocket> = new Map();
    private reverseConnections: Map<WebSocket, string> = new Map();
    private formats: Map<string, "json" | "binary"> = new Map()
    lastActivity: Map<string, number> = new Map();

    updateLastActivity(chargePointId: string) {
        this.lastActivity.set(chargePointId, Date.now());
    }

    isActive(chargePointId: string, timeout = INTERVAL * 1000) {
        const lstAct = this.lastActivity.get(chargePointId);
        return lstAct && (Date.now() - lstAct < timeout);  // Разница ВМЕСТО сравнения
    }
    add(ws: WebSocket, chargePointId: string) {
        this.connections.set(chargePointId, ws);
        this.reverseConnections.set(ws, chargePointId);  // reverse
        this.updateLastActivity(chargePointId);  // Если есть
    }

    remove(chargePointId: string) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);  // Удали reverse
        }
        this.connections.delete(chargePointId);
    }

    get(chargePointId: string): WebSocket | undefined {
        return this.connections.get(chargePointId);
    }
    getByWs(ws: WebSocket): string | undefined {
        return this.reverseConnections.get(ws);
    }

    setLastOffline(chargePointId: string, date: Date) {
        ChargePoint.findOneAndUpdate(
            { id: chargePointId },
            { lastOffline: date },
            { upsert: true }
        ).then(() => logger.info(`Set lastOffline for ${chargePointId}: ${date}`))
            .catch(err => logger.error(`Error set lastOffline: ${err}`));
        const ws = this.connections.get(chargePointId);
        if (ws) (ws as any).lastOffline = date;
    }

    setFormat(chargePointId: string, format: 'json' | 'binary') {
        this.formats.set(chargePointId, format)
    }
    getFormat(chargePointId: string) {
        return this.formats.get(chargePointId) || 'json' //дефолт - json
    }

}