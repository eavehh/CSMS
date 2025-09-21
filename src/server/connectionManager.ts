import WebSocket from 'ws';

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
}