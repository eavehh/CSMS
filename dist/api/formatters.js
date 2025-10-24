"use strict";
// Форматирование ответа станции для фронта
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateTime = formatDateTime;
exports.formatTransaction = formatTransaction;
exports.formatConnector = formatConnector;
exports.formatStation = formatStation;
/**
 * Форматирует дату в ISO строку с учётом локальной временной зоны
 * Если дата уже строка ISO - возвращает как есть
 * Если дата объект Date - конвертирует в ISO с правильной зоной
 */
function formatDateTime(date) {
    if (!date)
        return null;
    // Если уже строка, возвращаем как есть
    if (typeof date === 'string') {
        return date;
    }
    // Если объект Date, конвертируем в ISO
    if (date instanceof Date) {
        return date.toISOString();
    }
    return null;
}
/**
 * Форматирует транзакцию для API ответа
 * Гарантирует правильное форматирование времени
 */
function formatTransaction(tx) {
    return {
        ...tx,
        startTime: formatDateTime(tx.startTime),
        stopTime: formatDateTime(tx.stopTime),
    };
}
function formatConnector(connectorId, state) {
    return {
        id: connectorId,
        type: state.type || 'Unknown',
        status: state.status || 'Unknown',
        power_kW: state.currentPower || 0,
        soc: state.soc || null,
        transactionId: state.transactionId || null, // FIX: было currentTransactionId
        price: 15.0, // или получай из тарифа в БД
        updatedAt: state.lastUpdate || state.updatedAt || new Date().toISOString()
    };
}
function formatStation(stationId, connectorsMap) {
    const connectors = Array.from(connectorsMap.entries())
        .filter(([id]) => id > 0) // 🔥 Исключаем коннектор 0
        .map(([id, state]) => formatConnector(id, state));
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
