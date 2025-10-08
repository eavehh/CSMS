import WebSocket from 'ws';
import { logger } from '../logger';
import { ChargePoint } from '../db/mongoose';
import { INTERVAL } from './handlers/bootNotification';


export interface ConnectorState {
    status: string;
    transactionId?: string;
    errorCode?: string;
    lastUpdate: Date;
    reservationId?: number;
    reservedUntil?: Date;
}

export class ConnectionManager {
    private connections: Map<string, WebSocket> = new Map();
    private reverseConnections: Map<WebSocket, string> = new Map();
    private formats: Map<string, "json" | "binary"> = new Map();
    private connectorStates: Map<string, Map<number, ConnectorState>> = new Map();
    lastActivity: Map<string, number> = new Map();
    reservationCleanupInterval: NodeJS.Timeout | null = null;

    updateLastActivity(chargePointId: string) {
        this.lastActivity.set(chargePointId, Date.now());
    }

    isActive(chargePointId: string, timeout = INTERVAL * 1000) {
        const lstAct = this.lastActivity.get(chargePointId);
        return lstAct && (Date.now() - lstAct < timeout);
    }

    add(ws: WebSocket, chargePointId: string) {
        this.connections.set(chargePointId, ws);
        this.reverseConnections.set(ws, chargePointId);
        this.updateLastActivity(chargePointId);
        // Новое: Инициализируем состояния коннекторов (дефолт: 1 коннектор, 'Available')
        if (!this.connectorStates.has(chargePointId)) {
            const defaultConnectors = new Map<number, ConnectorState>();
            defaultConnectors.set(1, { status: 'Available', lastUpdate: new Date() });
            this.connectorStates.set(chargePointId, defaultConnectors);
            logger.info(`[AddConnection] Initialized default connector states for ${chargePointId}`);
        }
    }

    remove(chargePointId: string) {
        const ws = this.connections.get(chargePointId);
        if (ws) {
            this.reverseConnections.delete(ws);
        }
        this.connections.delete(chargePointId);
        // Новое: Очищаем состояния коннекторов
        this.connectorStates.delete(chargePointId);
    }

    get(chargePointId: string): WebSocket | undefined {
        return this.connections.get(chargePointId);
    }

    getAllConnections(): Map<string, WebSocket> | undefined {
        return this.connections;
    }

    getByWs(ws: WebSocket): string | undefined {
        return this.reverseConnections.get(ws);
    }

    setLastOffline(chargePointId: string, date: Date) {
        ChargePoint.findOneAndUpdate(
            { id: chargePointId },
            { lastOffline: date },
            { upsert: true }
        ).then(() => logger.info(`[Heartbeat] Set lastOffline for ${chargePointId}: ${date}`))
            .catch(err => logger.error(`[Heartbeat] Error set [lastOffline]: ${err}`));
        const ws = this.connections.get(chargePointId);
        if (ws) (ws as any).lastOffline = date;
    }

    setFormat(chargePointId: string, format: 'json' | 'binary') {
        this.formats.set(chargePointId, format);
    }

    getFormat(chargePointId: string) {
        return this.formats.get(chargePointId) || 'json';
    }


    getConnectorState(chargePointId: string, connectorId: number): ConnectorState | undefined {
        const states = this.connectorStates.get(chargePointId);
        return states ? states.get(connectorId) : undefined;
    }

    updateConnectorState(
        chargePointId: string,
        connectorId: number,
        status: 'Available' | 'Preparing' | 'Charging' | 'Finishing' | 'Reserved' | 'Unavailable' | 'Faulted',
        transactionId?: string,
        errorCode?: string,
        reservationId?: number,
        expiryDate?: Date
    ): void {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map<number, ConnectorState>();
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
        logger.info(`[UpdatedConnector] ${connectorId} for ${chargePointId}: ${status}${transactionId ? ` (transaction id: ${transactionId})` : ''}`);
        this.updateLastActivity(chargePointId);  // Обновляем активность станции
    }


    initializeConnectors(chargePointId: string, numConnectors: number = 1): void {
        let states = this.connectorStates.get(chargePointId);
        if (!states) {
            states = new Map<number, ConnectorState>();
            this.connectorStates.set(chargePointId, states);
        }
        for (let i = 1; i <= numConnectors; i++) {
            if (!states.has(i)) {
                states.set(i, { status: 'Available', lastUpdate: new Date() });
            }
        }
        logger.info(`[initializeConnectors] Initialized ${numConnectors} connectors for ${chargePointId}`);
    }

    getAllConnectors(chargePointId: string): Map<number, ConnectorState> | undefined {
        return this.connectorStates.get(chargePointId);
    }


    getAllChargePointsWithConnectors(): Map<string, Map<number, ConnectorState>> {
        return this.connectorStates;
    }

    cleanupExpiredReservations() {
        this.connectorStates.forEach((states, chargePointId) => {
            states.forEach((state, connectorId) => {
                if (state.status === 'Reserved' && state.reservedUntil && new Date() > state.reservedUntil) {
                    this.updateConnectorState(chargePointId, connectorId, 'Available');
                    logger.info(`Expired reservation cleared for connector ${connectorId} on ${chargePointId}`);
                }
            });
        });
    }
}
