"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStations = getStations;
exports.startStationsApiHandler = startStationsApiHandler;
exports.stopStationsApiHandler = stopStationsApiHandler;
const node_fetch_1 = __importDefault(require("node-fetch")); // npm install node-fetch
const logger_1 = require("../../logger");
const httpHandlers_1 = require("../httpHandlers");
const index_1 = require("../../server/index");
const formatters_1 = require("../formatters");
const httpHandlers_2 = require("../httpHandlers");
function getStations(req, res) {
    (async () => {
        try {
            // Получаем только активные станции
            const activeStations = Array.from(index_1.connectionManager.getAllConnections()?.keys() || []);
            const stationsMap = index_1.connectionManager.getAllChargePointsWithConnectors();
            // Формируем только онлайн станции
            const data = Array.from(stationsMap.entries())
                .filter(([stationId]) => activeStations.includes(stationId))
                .map(([stationId, connectors]) => (0, formatters_1.formatStation)(stationId, connectors));
            (0, httpHandlers_1.sendJson)(res, 200, { success: true, data });
            logger_1.logger.info(`[httpHandlers] GET /api/stations response formatted (only active stations)`);
        }
        catch (err) {
            logger_1.logger.error(`[httpHandlers] Stations query error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 400, {
                success: false,
                error: 'Missing required fields'
            });
        }
    })();
    return;
}
function startStationsApiHandler(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { chargePointId } = JSON.parse(body);
            const response = await (0, node_fetch_1.default)(`${httpHandlers_2.STATION_URL}/start-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chargePointId })
            });
            const data = await response.json();
            (0, httpHandlers_1.sendJson)(res, 200, { success: true, message: data.message });
        }
        catch (err) {
            logger_1.logger.error(`[API] start-station Error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Station start error' });
        }
    });
    return;
}
function stopStationsApiHandler(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const response = await (0, node_fetch_1.default)(`${httpHandlers_2.STATION_URL}/stop-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            (0, httpHandlers_1.sendJson)(res, 200, { success: true, message: data.message });
        }
        catch (err) {
            logger_1.logger.error(`[API] stop-station Error: ${err}`);
            (0, httpHandlers_1.sendJson)(res, 500, { success: false, error: 'Station stop error' });
        }
    });
}
