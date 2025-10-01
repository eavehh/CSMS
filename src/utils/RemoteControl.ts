import { v4 as uuidv4 } from "uuid";
import { ConnectionManager } from "../server/connectionManager";
import { logger } from "../logger";

export function sendRemoteMessage(connectionManager: ConnectionManager, chargePointId: string, action: string, payload: any): void {
    const ws = connectionManager.get(chargePointId)

    if (!ws) {
        logger.error(`No connection to charge point ${chargePointId}`);
        return;
    }
    const message = [2, uuidv4(), action, payload]
    ws.send(JSON.stringify(message))
    logger.info(`Sent ${action} to ${chargePointId}`);
}
export function sendRemoteStart(connectionManager: ConnectionManager, chargePointId: string) {
    const payload = { idTag: 'TAG001', connectorId: 1 };
    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStartTransaction', payload);
}