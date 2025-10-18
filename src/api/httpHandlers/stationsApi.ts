import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import fetch from 'node-fetch'; // npm install node-fetch
import { sendJson } from '../httpHandlers'
import { connectionManager } from '../../server/index';
import { formatStation } from '../formatters';
import { STATION_URL } from '../httpHandlers'

export function getStations(req: IncomingMessage, res: ServerResponse) {
    (async () => {
        try {
            // Получаем только активные станции
            const activeStations = Array.from(connectionManager.getAllConnections()?.keys() || []);
            const stationsMap = connectionManager.getAllChargePointsWithConnectors();

            // Формируем только онлайн станции
            const data = Array.from(stationsMap.entries())
                .filter(([stationId]) => activeStations.includes(stationId))
                .map(([stationId, connectors]) => formatStation(stationId, connectors));

            sendJson(res, 200, { success: true, data });
            logger.info(`[httpHandlers] GET /api/stations response formatted (only active stations)`);
        } catch (err) {
            logger.error(`[httpHandlers] Stations query error: ${err}`);
            sendJson(res, 400, {
                success: false,
                error: 'Missing required fields'
            });
        }
    })();
    return;
}
export function startStationsApiHandler(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { chargePointId } = JSON.parse(body);
            const response = await fetch(`${STATION_URL}/start-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chargePointId })
            });
            const data = await response.json();
            sendJson(res, 200, { success: true, message: (data as any).message });
        } catch (err) {
            logger.error(`[API] start-station Error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Station start error' });
        }
    });
    return;
}

export function stopStationsApiHandler(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const response = await fetch(`${STATION_URL}/stop-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            sendJson(res, 200, { success: true, message: (data as any).message });
        } catch (err) {
            logger.error(`[API] stop-station Error: ${err}`);
            sendJson(res, 500, { success: false, error: 'Station stop error' });
        }
    });
}