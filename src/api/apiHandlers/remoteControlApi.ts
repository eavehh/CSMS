import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { sendJson } from '../httpHandlers';
import { ConnectionManager } from '../../server/connectionManager';
import { sendRemoteMessage } from '../../server/remoteControl';

/**
 * POST /api/remote-control
 * Отправка команд на станцию (ChangeConfiguration, Reset, и т.д.)
 */
export async function remoteControlApiHandler(
    req: IncomingMessage,
    res: ServerResponse,
    connectionManager: ConnectionManager
) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method not allowed' });
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { chargePointId, action, payload } = JSON.parse(body);

            if (!chargePointId || !action || !payload) {
                return sendJson(res, 400, {
                    success: false,
                    error: 'Missing required fields: chargePointId, action, payload'
                });
            }

            // Проверяем что станция онлайн
            const ws = connectionManager.get(chargePointId);
            if (!ws) {
                return sendJson(res, 404, {
                    success: false,
                    error: `Charge point ${chargePointId} is not connected`
                });
            }

            // Отправляем команду
            sendRemoteMessage(connectionManager, chargePointId, action, payload);

            logger.info(`[RemoteControlAPI] Command sent: ${action} to ${chargePointId}`);

            return sendJson(res, 200, {
                success: true,
                message: `Command ${action} sent to ${chargePointId}`,
                data: { chargePointId, action, payload }
            });

        } catch (error) {
            logger.error(`[RemoteControlAPI] Error: ${error}`);
            return sendJson(res, 500, {
                success: false,
                error: 'Invalid JSON or internal error'
            });
        }
    });
}
