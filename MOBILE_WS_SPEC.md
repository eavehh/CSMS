# Mobile WebSocket Integration Spec (it_charge)

Version: draft-5 (timeouts env, eventId, getEventsRecent)
Environment: current branch `experiment/no-postgres`

## 1. Endpoint & TLS
Staging WS URL: `ws://<HOST>:8081/ocpp`
Production SHOULD use TLS: `wss://<DOMAIN>/ocpp` (terminate TLS at reverse proxy).
Certificates: none special yet. If self-signed in staging, mobile must trust CA.
Handshake: optional `Origin` validation. If server env `ALLOWED_ORIGIN` set, other Origins rejected.

## 2. Authentication
Implemented initial auth message:
```
{ "id":"auth-1", "action":"auth", "params": { "apiKey":"demo-key" } }
→ { "id":"auth-1", "result": { "status":"ok", "sessionId":"sess-1730040000000", "scopes":[] } }
```
Failure example:
```
{ "id":"auth-1", "error": { "code":401, "message":"Invalid apiKey" } }
```
Token expiry & reauth TBD (session bound to socket lifetime).

## 3. Message Formats (Dual Support)
Legacy:
```
{ "id":"<uuid>", "method":"GET", "url":"/api/stations" }
→ { "id":"<uuid>", "status":200, "data": { success:true, data:[...] } }
```
Action-based:
```
{ "id":"<uuid>", "action":"getStations" }
→ { "id":"<uuid>", "result":[ ...stations ] }
```
Errors (action): `{ "id":"<uuid>", "error": { "code":400, "message":"Unknown action" } }`
All messages JSON.

## 4. Ping / Heartbeat
Action ping:
```
{ "id":"ping-1", "action":"ping" }
→ { "id":"ping-1", "result": { "pong": true, "ts": 1730040000000 } }
```
Client interval: ~20s if idle.

## 5. Correlation & Error Handling
Correlation via `id`. Legacy errors: `{id,status,error}`. Action errors: `{id,error:{code,message}}`.

## 6. Actions / Endpoints (Implemented)
getStations, getRecentTransactions, getMySessions, getConnectorStatus, startCharging (mock), stopCharging (mock), deleteTransaction, deleteTransactionsAll, getMeterValuesRecent, subscribe, unsubscribe, ping, auth.
startCharging / stopCharging now use real OCPP RemoteStartTransaction / RemoteStopTransaction messages with polling confirmation.
Timeouts configurable via env: `REMOTE_START_TIMEOUT_MS` / `REMOTE_STOP_TIMEOUT_MS` (default 5000 ms).
### startCharging (real OCPP)
```
{ "id":"start-1", "action":"startCharging", "params": { "stationId":"fora072", "connectorId":1, "idTag":"ABC123" } }
→ { "id":"start-1", "result": { "status":"Accepted", "stationId":"fora072", "connectorId":1 } }
```
If charging state not observed within 5s:
```
{ "id":"start-1", "error": { "code":504, "message":"RemoteStart timeout or not reflected" } }
Event broadcast on completion:
```
{ "event":"remote.start.result", "stationId":"fora072", "connectorId":1, "idTag":"ABC123", "status":"Accepted", "ts":1730044000000 }
```

### stopCharging (real OCPP)
```
{ "id":"stop-1", "action":"stopCharging", "params": { "stationId":"fora072", "connectorId":1, "transactionId":"1730041010000" } }
→ { "id":"stop-1", "result": { "status":"Accepted", "stationId":"fora072", "connectorId":1, "transactionId":"1730041010000" } }
```
If state not changed from Charging within 5s:
```
{ "id":"stop-1", "error": { "code":504, "message":"RemoteStop timeout or not reflected" } }
Event broadcast:
```
{ "event":"remote.stop.result", "stationId":"fora072", "connectorId":1, "transactionId":"1730041010000", "status":"Accepted", "ts":1730044010000 }
```

Examples:
Stations:
```
{ "id":"1", "action":"getStations" }
→ { "id":"1", "result":[ { "id":"fora072", "status":"Charging", "isOnline":true, ... } ] }
```
Subscribe:
```
{ "id":"sub-1", "action":"subscribe", "params": { "stationId":"fora072", "events":["connector.status.changed","transaction.*"] } }
→ { "id":"sub-1", "result": { "subscriptionId":"sub-<...>", "snapshot": { "stations":[...] } } }
```
MeterValues recent:
```
{ "id":"mv-1", "action":"getMeterValuesRecent", "params": { "stationId":"fora072", "limit":10 } }
→ { "id":"mv-1", "result":[ { "stationId":"fora072", "connectorId":1, "timestamp":"...", "sampledValue":[...] } ] }
# Mobile WebSocket API Specification (Draft-6)

Status: draft-6 (clean)
Updated: 2025-10-23

## 1. Overview
Mobile client uses a persistent WebSocket. Two request envelopes supported:
1. Legacy: `{ id, method, url, data? }`
2. Action-based: `{ id, action, params? }` (recommended)

Server pushes event objects without `id`.

## 2. Authentication
Action `auth` exchanges API key for a session.

Request:
```json
{ "id": "1", "action": "auth", "params": { "apiKey": "<API_KEY>" } }
```
Success:
```json
{ "id": "1", "result": { "status": "ok", "sessionId": "sess-<ts>", "scopes": ["basic"] } }
```
Failure:
```json
{ "id": "1", "error": { "code": 401, "message": "Invalid apiKey" } }
```
Expiry: `WS_SESSION_MAX_AGE_MS` (default 86400000). When exceeded:
```json
{ "event": "session.expired", "ts": 1690000000000 }
```
Protected actions then return 401 until re-auth.

## 3. Envelope Fields
`id`, `action`, `params`, `result`, `error { code, message, correlationId? }`.

## 4. Actions
auth, ping, getStations, getRecentTransactions, startCharging, stopCharging, getConnectorStatus, getMySessions, getMeterValuesRecent, subscribe, unsubscribe, deleteTransaction, deleteTransactionsAll, getEventsRecent, getEventsSince.

## 5. Remote Start/Stop
`startCharging` triggers OCPP RemoteStartTransaction. Response on success includes `correlationId`.
Events: `remote.start.result`, `transaction.started` (may include correlationId), `remote.stop.result`, `transaction.stopped`.
Timeout → `PendingTimeout` with error code 504.

## 6. Events
Each event: `eventId`, `event`, `ts`, plus payload fields.
Types: connector.status.changed, transaction.started, transaction.stopped, remote.start.result, remote.stop.result, meter.values.delta, session.expired, rate.limit, message.too.large.

## 7. Replay
In-memory: `getEventsRecent` (~200 latest).
Persistent: `getEventsSince` (Mongo) by `eventId` or `ts`, limited by `EVENTS_REPLAY_MAX_LIMIT` (default 500).

## 8. Subscriptions
`subscribe` with optional `stationId` and `events[]` (supports wildcard suffix `*`). No subscription = all events.

## 9. Meter Values Delta
Throttled (`METER_VALUES_DELTA_INTERVAL_MS`, default 2000ms) broadcast of energy delta event `meter.values.delta` with fields total, delta, transactionId?, connectorId, measurand, unit.

## 10. Limits
Message size: `WS_MAX_MESSAGE_BYTES` (default 32768). Exceed → event `message.too.large` then close.
Rate: `WS_RATE_MAX` messages / 10s window. Exceed → event `rate.limit` then close.

## 11. Session Expiry
Automatic. Client listens for `session.expired` and re-sends `auth`.

## 12. Env Variables
ALLOWED_ORIGIN, WS_RATE_MAX, WS_MAX_MESSAGE_BYTES, WS_SESSION_MAX_AGE_MS, REMOTE_START_TIMEOUT_MS, REMOTE_STOP_TIMEOUT_MS, METER_VALUES_DELTA_INTERVAL_MS, EVENTS_REPLAY_MAX_LIMIT.

## 13. Error Codes
400, 401, 404, 500, 504.

## 14. Future
Pagination cursors, multi-station filters, power aggregation, binary compression.

## 15. Reconnect Flow
1. Open WS
2. `auth`
3. `getEventsSince` with last stored `eventId`; fallback `getEventsRecent` if unknown.

## 16. Versioning
This is draft-6. Clients should detect draft updates out of band (e.g. file hash or manual bump).

---
End draft-6.
