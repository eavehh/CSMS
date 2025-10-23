"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteControlApiHandler = remoteControlApiHandler;
const logger_1 = require("../../logger");
const httpHandlers_1 = require("../httpHandlers");
const remoteControl_1 = require("../../server/remoteControl");
/**
 * POST /api/remote-control
 * Отправка команд на станцию (ChangeConfiguration, Reset, и т.д.)
 */
async function remoteControlApiHandler(req, res, connectionManager) {
    if (req.method !== 'POST') {
        return (0, httpHandlers_1.sendJson)(res, 405, { success: false, error: 'Method not allowed' });
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { chargePointId, action, payload } = JSON.parse(body);
            if (!chargePointId || !action || !payload) {
                return (0, httpHandlers_1.sendJson)(res, 400, {
                    success: false,
                    error: 'Missing required fields: chargePointId, action, payload'
                });
            }
            // Проверяем что станция онлайн
            const ws = connectionManager.get(chargePointId);
            if (!ws) {
                return (0, httpHandlers_1.sendJson)(res, 404, {
                    success: false,
                    error: `Charge point ${chargePointId} is not connected`
                });
            }
            // Отправляем команду
            (0, remoteControl_1.sendRemoteMessage)(connectionManager, chargePointId, action, payload);
            logger_1.logger.info(`[RemoteControlAPI] Command sent: ${action} to ${chargePointId}`);
            return (0, httpHandlers_1.sendJson)(res, 200, {
                success: true,
                message: `Command ${action} sent to ${chargePointId}`,
                data: { chargePointId, action, payload }
            });
        }
        catch (error) {
            logger_1.logger.error(`[RemoteControlAPI] Error: ${error}`);
            return (0, httpHandlers_1.sendJson)(res, 500, {
                success: false,
                error: 'Invalid JSON or internal error'
            });
        }
    });
}
