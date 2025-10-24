# Mobile WebSocket API Documentation для it_charge

## 1. Endpoint и TLS

### Production/Staging
```
wss://193.29.139.202:8081/ws
```

### TLS
- **wss обязателен**: Нет, можно использовать `ws://` для тестирования
- **Self-signed сертификаты**: Нет специальных требований
- **Дополнительные заголовки**: Не требуются при handshake

### Тестовое подключение
```javascript
const ws = new WebSocket('ws://193.29.139.202:8081/ws');
```

---

## 2. Аутентификация

### Схема: API Key через initial message

#### 2.1. Auth Request (первое сообщение после connect)
```json
{
  "id": "uuid-12345",
  "action": "auth",
  "params": {
    "apiKey": "your-api-key-here"
  }
}
```

#### 2.2. Auth Success Response
```json
{
  "id": "uuid-12345",
  "result": {
    "status": "ok",
    "sessionId": "sess-1729786800000",
    "scopes": ["read:stations", "write:charging"]
  }
}
```

#### 2.3. Auth Failure Response
```json
{
  "id": "uuid-12345",
  "error": {
    "code": 401,
    "message": "Invalid apiKey"
  }
}
```

#### 2.4. API Key для тестирования
- **Тестовый ключ**: `test-mobile-key-123` (нужно создать в MongoDB)
- **Создание ключа** через MongoDB:
```javascript
db.apikeys.insertOne({
  key: "test-mobile-key-123",
  active: true,
  scopes: ["read:stations", "write:charging"],
  createdAt: new Date()
})
```

#### 2.5. Реаутентификация
- Токен не истекает в рамках WebSocket сессии
- При переподключении нужно заново отправить `auth` action

---

## 3. Формат сообщений

### Стиль: Action-based RPC

Все сообщения в формате JSON с обязательным полем `id` для корреляции.

#### 3.1. Request Format
```json
{
  "id": "<uuid>",
  "action": "<actionName>",
  "params": { /* action-specific */ }
}
```

#### 3.2. Success Response Format
```json
{
  "id": "<same-uuid-as-request>",
  "result": { /* action result */ }
}
```

#### 3.3. Error Response Format
```json
{
  "id": "<same-uuid-as-request>",
  "error": {
    "code": 400,
    "message": "Error description",
    "correlationId": "optional-for-tracking"
  }
}
```

---

## 4. Heartbeat

### Ping Request
```json
{
  "id": "ping-uuid-123",
  "action": "ping"
}
```

### Pong Response
```json
{
  "id": "ping-uuid-123",
  "result": {
    "pong": true,
    "ts": 1729786800000
  }
}
```

**Рекомендуемый интервал**: 20-30 секунд

---

## 5. Корреляция и ошибки

✅ **Response всегда содержит request.id**

### Error Codes
- `400` - Bad Request (неверные параметры)
- `401` - Unauthorized (не авторизован или неверный API key)
- `403` - Forbidden (недостаточно прав)
- `404` - Not Found (ресурс не найден)
- `500` - Internal Server Error

---

## 6. Ключевые Actions с примерами

### 6.1. getStations - Получить список станций

#### Request
```json
{
  "id": "req-001",
  "action": "getStations"
}
```

#### Response
```json
{
  "id": "req-001",
  "result": [
    {
      "id": "fora072",
      "name": "fora072",
      "status": "Charging",
      "isOnline": true,
      "lastActivity": "2025-10-24T16:00:00.000Z",
      "connectors": [
        {
          "id": 1,
          "status": "Available",
          "transactionId": null,
          "errorCode": null,
          "updatedAt": "2025-10-24T16:00:00.000Z"
        },
        {
          "id": 2,
          "status": "Charging",
          "transactionId": 1761308241,
          "errorCode": null,
          "updatedAt": "2025-10-24T16:00:00.000Z"
        }
      ]
    }
  ]
}
```

**Station Status Values**:
- `Available` - все коннекторы доступны
- `Charging` - хотя бы один коннектор заряжает
- `PartiallyAvailable` - часть коннекторов доступна
- `Offline` - станция не на связи

**Connector Status Values**:
- `Available` - готов к зарядке
- `Preparing` - подготовка к зарядке
- `Charging` - идет зарядка
- `SuspendedEV` - приостановлено со стороны машины
- `SuspendedEVSE` - приостановлено со стороны станции
- `Finishing` - завершение зарядки
- `Reserved` - зарезервирован
- `Unavailable` - недоступен
- `Faulted` - ошибка

---

### 6.2. getConnectorStatus - Статус конкретного коннектора

#### Request
```json
{
  "id": "req-002",
  "action": "getConnectorStatus",
  "params": {
    "stationId": "fora072",
    "connectorId": 2
  }
}
```

#### Response
```json
{
  "id": "req-002",
  "result": {
    "stationId": "fora072",
    "connectorId": 2,
    "status": "Charging",
    "transactionId": 1761308241,
    "errorCode": null,
    "power": 50000,
    "current": 125.5,
    "voltage": 400.0,
    "energy": 15000,
    "updatedAt": "2025-10-24T16:00:00.000Z"
  }
}
```

---

### 6.3. startCharging - Запустить зарядку (ASYNC)

#### Request
```json
{
  "id": "req-003",
  "action": "startCharging",
  "params": {
    "stationId": "fora072",
    "connectorId": 2,
    "idTag": "MOBILE_USER_12345"
  }
}
```

#### Immediate Response (синхронный)
```json
{
  "id": "req-003",
  "result": {
    "status": "pending",
    "correlationId": "corr-1729786800-fora072-2"
  }
}
```

#### Push Event (асинхронный, когда станция ответит)
```json
{
  "event": "transaction.started",
  "data": {
    "transactionId": 1761308241,
    "stationId": "fora072",
    "connectorId": 2,
    "idTag": "MOBILE_USER_12345",
    "startTime": "2025-10-24T16:00:00.000Z",
    "correlationId": "corr-1729786800-fora072-2"
  }
}
```

**Важно**: 
- Запрос startCharging может занимать 2-10 секунд
- Сначала приходит `status: pending`
- Затем асинхронно приходит event `transaction.started`
- Для связи используйте `correlationId`

---

### 6.4. stopCharging - Остановить зарядку (ASYNC)

#### Request (по transactionId)
```json
{
  "id": "req-004",
  "action": "stopCharging",
  "params": {
    "transactionId": 1761308241
  }
}
```

#### Или (по stationId + connectorId)
```json
{
  "id": "req-004",
  "action": "stopCharging",
  "params": {
    "stationId": "fora072",
    "connectorId": 2
  }
}
```

#### Immediate Response
```json
{
  "id": "req-004",
  "result": {
    "status": "pending",
    "correlationId": "corr-stop-1729786900"
  }
}
```

#### Push Event (когда транзакция завершится)
```json
{
  "event": "transaction.stopped",
  "data": {
    "transactionId": 1761308241,
    "stationId": "fora072",
    "connectorId": 2,
    "stopTime": "2025-10-24T17:00:00.000Z",
    "energy": 15500,
    "duration": 3600,
    "cost": 1.55,
    "reason": "Remote"
  }
}
```

---

### 6.5. getMySessions - Получить последние транзакции

#### Request
```json
{
  "id": "req-005",
  "action": "getMySessions"
}
```

#### Response
```json
{
  "id": "req-005",
  "result": [
    {
      "transactionId": 1761308241,
      "stationId": "fora072",
      "connectorId": 2,
      "idTag": "MOBILE_USER_12345",
      "startTime": "2025-10-24T16:00:00.000Z",
      "stopTime": "2025-10-24T17:00:00.000Z",
      "energy": 15500,
      "cost": 1.55,
      "status": "completed"
    }
  ]
}
```

---

## 7. Push-события (Server → Client)

Все события приходят в формате:
```json
{
  "event": "<eventType>",
  "data": { /* event payload */ }
}
```

### 7.1. connector.status.changed
```json
{
  "event": "connector.status.changed",
  "data": {
    "stationId": "fora072",
    "connectorId": 2,
    "status": "Charging",
    "transactionId": 1761308241,
    "timestamp": "2025-10-24T16:00:00.000Z"
  }
}
```

### 7.2. transaction.started
```json
{
  "event": "transaction.started",
  "data": {
    "transactionId": 1761308241,
    "stationId": "fora072",
    "connectorId": 2,
    "idTag": "MOBILE_USER_12345",
    "startTime": "2025-10-24T16:00:00.000Z",
    "correlationId": "corr-1729786800-fora072-2"
  }
}
```

### 7.3. transaction.stopped
```json
{
  "event": "transaction.stopped",
  "data": {
    "transactionId": 1761308241,
    "stationId": "fora072",
    "connectorId": 2,
    "stopTime": "2025-10-24T17:00:00.000Z",
    "energy": 15500,
    "cost": 1.55,
    "reason": "Remote"
  }
}
```

### 7.4. meter.update (реальное время)
```json
{
  "event": "meter.update",
  "data": {
    "stationId": "fora072",
    "connectorId": 2,
    "transactionId": 1761308241,
    "timestamp": "2025-10-24T16:30:00.000Z",
    "energy": 7500,
    "power": 50000,
    "current": 125.5,
    "voltage": 400.0
  }
}
```

### 7.5. station.connected / station.disconnected
```json
{
  "event": "station.connected",
  "data": {
    "stationId": "fora072",
    "timestamp": "2025-10-24T16:00:00.000Z"
  }
}
```

### Гарантии доставки
- **Ordering**: события для одной станции упорядочены
- **Delivery**: at-least-once (может быть дубликат при reconnect)
- **Deduplication**: используйте `timestamp` или `eventId` для дедупликации

---

## 8. Подписки

### 8.1. Subscribe на все события
```json
{
  "id": "req-006",
  "action": "subscribe",
  "params": {
    "events": ["all"]
  }
}
```

### 8.2. Subscribe на конкретную станцию
```json
{
  "id": "req-006",
  "action": "subscribe",
  "params": {
    "stationId": "fora072",
    "events": ["connector.status.changed", "transaction.started", "transaction.stopped"]
  }
}
```

### 8.3. Response с initial snapshot
```json
{
  "id": "req-006",
  "result": {
    "subscriptionId": "sub-1729786800-001",
    "snapshot": {
      "stations": [
        {
          "id": "fora072",
          "status": "Available",
          "connectors": [...]
        }
      ]
    }
  }
}
```

### 8.4. Unsubscribe
```json
{
  "id": "req-007",
  "action": "unsubscribe",
  "params": {
    "subscriptionId": "sub-1729786800-001"
  }
}
```

---

## 9. Reconnect Strategy

### При переподключении:
1. Установить новое WebSocket соединение
2. Отправить `auth` action
3. Отправить `subscribe` action заново
4. Получить свежий snapshot

### Resume пропущенных событий (опционально)
```json
{
  "id": "req-008",
  "action": "getEventsSince",
  "params": {
    "since": "2025-10-24T16:00:00.000Z",
    "limit": 100
  }
}
```

Response:
```json
{
  "id": "req-008",
  "result": {
    "events": [
      {
        "eventType": "transaction.started",
        "stationId": "fora072",
        "timestamp": "2025-10-24T16:01:00.000Z",
        "data": {...}
      }
    ],
    "hasMore": false
  }
}
```

---

## 10. Лимиты и Performance

### Rate Limits
- **Messages/sec**: 10 сообщений в секунду
- **Max message size**: 1 MB
- **Connection timeout**: 60 секунд без ping/pong

### Latency
- **getStations**: < 100ms
- **startCharging**: 2-10 секунд (асинхронно)
- **stopCharging**: 2-10 секунд (асинхронно)
- **Push events**: < 500ms от момента события

---

## 11. Smoke Test Scenario (Staging)

### Шаг 1: Подключение и аутентификация
```javascript
const ws = new WebSocket('ws://193.29.139.202:8081/ws');

ws.onopen = () => {
  // 1. Auth
  ws.send(JSON.stringify({
    id: 'auth-001',
    action: 'auth',
    params: { apiKey: 'test-mobile-key-123' }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);
};
```

### Шаг 2: Subscribe + getStations
```javascript
// 2. Subscribe to all events
ws.send(JSON.stringify({
  id: 'sub-001',
  action: 'subscribe',
  params: { events: ['all'] }
}));

// 3. Get stations list
ws.send(JSON.stringify({
  id: 'get-001',
  action: 'getStations'
}));
```

### Шаг 3: Start Charging
```javascript
// 4. Start charging on connector 2
ws.send(JSON.stringify({
  id: 'start-001',
  action: 'startCharging',
  params: {
    stationId: 'fora072',
    connectorId: 2,
    idTag: 'MOBILE_TEST_USER'
  }
}));

// Wait for event:
// { "event": "transaction.started", "data": {...} }
```

### Шаг 4: Monitor + Stop
```javascript
// 5. Get connector status
ws.send(JSON.stringify({
  id: 'status-001',
  action: 'getConnectorStatus',
  params: {
    stationId: 'fora072',
    connectorId: 2
  }
}));

// 6. Stop charging
ws.send(JSON.stringify({
  id: 'stop-001',
  action: 'stopCharging',
  params: { transactionId: <received_from_start_event> }
}));

// Wait for event:
// { "event": "transaction.stopped", "data": {...} }
```

### Шаг 5: Ping/Pong
```javascript
// 7. Heartbeat
ws.send(JSON.stringify({
  id: 'ping-001',
  action: 'ping'
}));

// Response: { "id": "ping-001", "result": { "pong": true, "ts": ... } }
```

---

## 12. Staging Access

### Endpoints
- **WebSocket**: `ws://193.29.139.202:8081/ws`
- **HTTP API** (для тестов): `http://193.29.139.202:8081/api/`

### Test Credentials
- **API Key**: `test-mobile-key-123` (создать в MongoDB)

### Тестовая станция
- **Station ID**: `fora072`
- **Connectors**: 1, 2, 3, 4
- **Status**: Online

---

## 13. Примеры Raw Messages

### Connect + Auth + Subscribe + getStations
```
→ CONNECT ws://193.29.139.202:8081/ws
← CONNECTED

→ {"id":"1","action":"auth","params":{"apiKey":"test-mobile-key-123"}}
← {"id":"1","result":{"status":"ok","sessionId":"sess-1729786800","scopes":[]}}

→ {"id":"2","action":"subscribe","params":{"events":["all"]}}
← {"id":"2","result":{"subscriptionId":"sub-001","snapshot":{"stations":[...]}}}

→ {"id":"3","action":"getStations"}
← {"id":"3","result":[{"id":"fora072","status":"Available",...}]}
```

### Start Charging (async flow)
```
→ {"id":"4","action":"startCharging","params":{"stationId":"fora072","connectorId":2,"idTag":"USER_001"}}
← {"id":"4","result":{"status":"pending","correlationId":"corr-123"}}

... 2-5 seconds later ...

← {"event":"transaction.started","data":{"transactionId":1761308241,"stationId":"fora072",...,"correlationId":"corr-123"}}
```

### Ping/Pong
```
→ {"id":"5","action":"ping"}
← {"id":"5","result":{"pong":true,"ts":1729786800000}}
```

---

## Контакты для вопросов

При возникновении вопросов или проблем с интеграцией:
- Проверьте логи сервера: `tail -f logs/app-$(date +%Y-%m-%d).log`
- Все WebSocket сообщения логируются с префиксом `[WS-API:ACTION]`

Готовы к интеграции! 🚀
