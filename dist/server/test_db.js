"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const BASE_URL = 'http://localhost:8081';
function now() {
    return new Date().toISOString();
}
function log(title, payload) {
    if (payload === undefined) {
        console.log(`[${now()}] ${title}`);
    }
    else {
        console.log(`[${now()}] ${title}:`, payload);
    }
}
async function request(method, path, body) {
    const url = `${BASE_URL}${path}`;
    const startedAt = Date.now();
    const init = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined)
        init.body = JSON.stringify(body);
    const res = await (0, node_fetch_1.default)(url, init);
    const elapsedMs = Date.now() - startedAt;
    let data = null;
    try {
        data = await res.json();
    }
    catch (e) {
        // no json
    }
    log(`${method} ${path} (${res.status}) ${elapsedMs}ms`, data);
    return { status: res.status, data };
}
async function waitServer(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await request('GET', '/api/transactions');
            if (r.status === 200)
                return true;
        }
        catch (e) {
            // ignore
        }
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Server is not responding on /api/transactions');
}
async function startSession(chargePointId, connectorId, idTag) {
    const resp = await request('POST', '/api/start-session', {
        chargePointId,
        connectorId,
        idTag,
        limitType: 'full',
        limitValue: 100,
        tariffPerKWh: 0.1
    });
    return resp.data?.transactionId;
}
async function stopSession(transactionId, chargePointId, connectorId, idTag) {
    const resp = await request('POST', '/api/stop-session', {
        transactionId,
        chargePointId,
        connectorId,
        idTag,
        meterStop: 10000,
        timestamp: new Date().toISOString()
    });
    return resp;
}
async function getTransactions(chargePointId) {
    const q = chargePointId ? `?chargePointId=${encodeURIComponent(chargePointId)}` : '';
    return await request('GET', `/api/transactions${q}`);
}
async function getStations() {
    return await request('GET', '/api/stations');
}
async function getMetrics(chargePointId, from, to) {
    const params = new URLSearchParams();
    if (from)
        params.set('from', from);
    if (to)
        params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await request('GET', `/api/metrics/${encodeURIComponent(chargePointId)}${qs}`);
}
async function reserve(chargePointId, connectorId, idTag, expiryMinutes = 5) {
    return await request('POST', '/api/reserve', { chargePointId, connectorId, idTag, expiryMinutes });
}
async function main() {
    log('=== E2E: waiting server ready ===');
    await waitServer();
    const chargePointId = 'CP-001';
    const connectorId = 1;
    const idTag = 'user-123';
    // Stations
    log('=== E2E: GET /api/stations ===');
    await getStations();
    // Transactions empty or previous
    log('=== E2E: GET /api/transactions (initial) ===');
    await getTransactions(chargePointId);
    // Negative: start-session missing fields
    log('=== NEGATIVE: start-session missing fields ===');
    await request('POST', '/api/start-session', { chargePointId, connectorId });
    // Positive: start-session
    log('=== POSITIVE: start-session ===');
    const txId = await startSession(chargePointId, connectorId, idTag);
    if (!txId)
        throw new Error('Failed to get transactionId from start-session');
    // Transactions after start
    log('=== E2E: GET /api/transactions (after start) ===');
    await getTransactions(chargePointId);
    // Metrics
    log('=== E2E: GET /api/metrics ===');
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    await getMetrics(chargePointId, from, to);
    // Negative: reserve missing fields
    log('=== NEGATIVE: /api/reserve missing fields ===');
    await reserve(undefined, undefined, undefined);
    // Positive-ish: reserve with fields
    log('=== POSITIVE: /api/reserve with fields ===');
    await reserve(chargePointId, connectorId, idTag, 10);
    // Stop-session
    log('=== POSITIVE: stop-session ===');
    await stopSession(txId, chargePointId, connectorId, idTag);
    // Transactions after stop
    log('=== E2E: GET /api/transactions (after stop) ===');
    await getTransactions(chargePointId);
    log('=== E2E: done ===');
}
// Run
(async () => {
    try {
        await main();
        process.exit(0);
    }
    catch (err) {
        log('E2E FAILED', err);
        process.exit(1);
    }
})();
