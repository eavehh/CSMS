"use strict";
// Форматирование ответа станции для фронта
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatConnector = formatConnector;
exports.formatStation = formatStation;
function formatConnector(connectorId, state) {
    return {
        id: connectorId,
        type: state.type || 'Unknown',
        status: state.status || 'Unknown',
        power_kW: state.currentPower || 0,
        soc: state.soc || null,
        transactionId: state.currentTransactionId || null,
        price: 15.0, // или получай из тарифа в БД
        updatedAt: state.updatedAt || new Date().toISOString()
    };
}
function formatStation(stationId, connectorsMap) {
    const connectors = Array.from(connectorsMap.entries()).map(([id, state]) => formatConnector(id, state));
    const status = connectors.some(c => c.status === 'Charging')
        ? 'Charging'
        : connectors.every(c => c.status === 'Available')
            ? 'Available'
            : 'PartiallyAvailable';
    return {
        id: stationId,
        name: `Station ${stationId}`,
        status,
        connectors
    };
}
6;
