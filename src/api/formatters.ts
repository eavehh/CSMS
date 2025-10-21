// Форматирование ответа станции для фронта

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
    const connectors = Array.from(connectorsMap.entries()).map(([id, state]) =>
        formatConnector(id, state)
    );

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