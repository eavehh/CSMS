// Форматирование ответа станции для фронта

/**
 * Форматирует дату в ISO строку с учётом локальной временной зоны
 * Если дата уже строка ISO - возвращает как есть
 * Если дата объект Date - конвертирует в ISO с правильной зоной
 */
export function formatDateTime(date: Date | string | undefined | null): string | null {
    if (!date) return null;

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
export function formatTransaction(tx: any) {
    return {
        ...tx,
        startTime: formatDateTime(tx.startTime),
        stopTime: formatDateTime(tx.stopTime),
    };
}

export function formatConnector(connectorId: number, state: any) {
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

export function formatStation(stationId: string, connectorsMap: Map<number, any>) {
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
6