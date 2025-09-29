import WebSocket from 'ws';
import { logger } from '../logger';
import { ChargePoint } from '../db/mongoose'

export class ConnectionManager {
    private connections: Map<string, WebSocket> = new Map();
    private formats: Map<string, "json" | "binary"> = new Map()

    add(ws: WebSocket, chargePointId: string) {
        this.connections.set(chargePointId, ws);
    }

    remove(chargePointId: string) {
        this.connections.delete(chargePointId);
    }

    get(chargePointId: string): WebSocket | undefined {
        return this.connections.get(chargePointId);
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