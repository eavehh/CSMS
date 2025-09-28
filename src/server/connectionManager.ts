import WebSocket from 'ws';
import { logger } from '../server/logger';
import { ChargePoint } from '../db/mongoose'
import { lastOffline } from './wsServer';
export class ConnectionManager {
    private connections: Map<string, WebSocket> = new Map();

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
    }
}