# CSMS WebSocket API - Dart Integration Guide

## Connection

```
ws://193.29.139.202:8081/mobile-client
ws://192.168.88.54:8081/mobile-client
```

## Quick Start (Dart)

```dart
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class CSMSClient {
  late WebSocketChannel channel;
  final String apiKey;
  
  CSMSClient({required this.apiKey});
  
  Future<void> connect() async {
    channel = WebSocketChannel.connect(
      Uri.parse('ws://193.29.139.202:8081/mobile-client'),
    );
    
    channel.stream.listen((message) {
      final data = jsonDecode(message);
      if (data.containsKey('event')) {
        _handleEvent(data);  // Push-события
      } else if (data.containsKey('result')) {
        _handleResponse(data);  // Ответы на запросы
      }
    });
    
    // Авторизация
    send({'id': 'auth-1', 'action': 'auth', 'params': {'apiKey': apiKey}});
  }
  
  void send(Map<String, dynamic> msg) => channel.sink.add(jsonEncode(msg));
  
  void _handleEvent(Map<String, dynamic> event) {
    switch (event['event']) {
      case 'transaction.started': print('Started: ${event['transactionId']}'); break;
      case 'transaction.stopped': print('Stopped: ${event['transactionId']}'); break;
      case 'connector.status.changed': print('Status: ${event['status']}'); break;
      case 'meter.values.delta': print('Delta: ${event['delta']} Wh'); break;
      case 'session.expired': connect(); break;  // Переавторизация
    }
  }
  
  void _handleResponse(Map<String, dynamic> data) {
    print('Response: ${data['result']}');
  }
}
```

## Authentication

```dart
send({'id': 'auth-1', 'action': 'auth', 'params': {'apiKey': 'YOUR_KEY'}});
```
**Response:**
```json
{"id": "auth-1", "result": {"status": "ok", "sessionId": "sess-..."}}
```

## Main Actions

### Get Stations
```dart
send({'id': '1', 'action': 'getStations'});
```
```json
{"id": "1", "result": [{"id": "fora072", "status": "Charging", "isOnline": true, "connectors": [...]}]}
```

### Get Transactions
```dart
send({'id': '2', 'action': 'getRecentTransactions', 'params': {'limit': 10}});
```
```json
{"id": "2", "result": [{"transactionId": "123", "totalKWh": 15, "cost": 1.5, "status": "Completed"}]}
```

### Start Charging
```dart
send({'id': '3', 'action': 'startCharging', 'params': {
  'stationId': 'fora072', 'connectorId': 1, 'idTag': 'USER'
}});
```
**Success:**
```json
{"id": "3", "result": {"status": "Accepted", "correlationId": "corr-..."}}
```
**Timeout:**
```json
{"id": "3", "error": {"code": 504, "message": "RemoteStart timeout"}}
```

### Stop Charging
```dart
send({'id': '4', 'action': 'stopCharging', 'params': {
  'stationId': 'fora072', 'transactionId': '123', 'connectorId': 1
}});
```

### Get Connector Status
```dart
send({'id': '5', 'action': 'getConnectorStatus', 'params': {
  'stationId': 'fora072', 'connectorId': 1
}});
```

### Get Meter Values
```dart
send({'id': '6', 'action': 'getMeterValuesRecent', 'params': {
  'stationId': 'fora072', 'limit': 10
}});
```

### Subscribe to Events
```dart
send({'id': '7', 'action': 'subscribe', 'params': {
  'stationId': 'fora072', 'events': ['transaction.*', 'connector.*']
}});
```
**Response:**
```json
{"id": "7", "result": {"subscriptionId": "sub-...", "snapshot": {"stations": [...]}}}
```

### Unsubscribe
```dart
send({'id': '8', 'action': 'unsubscribe', 'params': {'subscriptionId': 'sub-...'}});
```

### Ping
```dart
send({'id': '9', 'action': 'ping'});
```
```json
{"id": "9", "result": {"pong": true, "ts": 1730000000000}}
```

## Push Events (no `id` field)

| Event | Fields |
|-------|--------|
| `connector.status.changed` | `stationId`, `connectorId`, `status` |
| `transaction.started` | `stationId`, `connectorId`, `transactionId`, `idTag`, `correlationId?` |
| `transaction.stopped` | `stationId`, `connectorId`, `transactionId`, `totalKWh`, `cost` |
| `remote.start.result` | `stationId`, `status`, `correlationId` |
| `remote.stop.result` | `stationId`, `transactionId`, `status` |
| `meter.values.delta` | `stationId`, `connectorId`, `delta`, `total`, `unit` |
| `session.expired` | `ts` |

**Example:**
```json
{
  "eventId": "evt-1730000000000-1234",
  "event": "transaction.started",
  "ts": 1730000000000,
  "stationId": "fora072",
  "transactionId": "123",
  "correlationId": "corr-..."
}
```

## Event Replay (reconnect)

### Recent events (in-memory)
```dart
send({'id': '10', 'action': 'getEventsRecent', 'params': {'limit': 50}});
```

### Events since last known eventId (persistent)
```dart
send({'id': '11', 'action': 'getEventsSince', 'params': {
  'eventId': 'evt-1730000000000-1234', 'limit': 100
}});
```
```json
{"id": "11", "result": {"events": [...], "count": 10, "cursor": {"lastEventId": "evt-..."}}}
```

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad params |
| 401 | Not authenticated |
| 404 | Not found |
| 500 | Internal error |
| 504 | Remote command timeout |

## Limits

- **Message size**: 32KB (default)
- **Rate**: 50 msg/10s (default)
- **Session**: 24h (auto-expire)

## Best Practices

1. **Reconnect**: Auto-reconnect + re-auth on disconnect
2. **Store eventId**: Save last `eventId` locally, use `getEventsSince` after reconnect
3. **Session expiry**: Listen for `session.expired` event → re-auth
4. **CorrelationId**: Match `startCharging` request with `transaction.started` event via `correlationId`

## Full Example

```dart
void main() async {
  final client = CSMSClient(apiKey: 'YOUR_KEY');
  await client.connect();
  
  await Future.delayed(Duration(seconds: 1));
  
  // Get stations
  client.send({'id': '1', 'action': 'getStations'});
  
  // Subscribe
  client.send({'id': '2', 'action': 'subscribe', 'params': {'stationId': 'fora072'}});
  
  // Start charging
  client.send({'id': '3', 'action': 'startCharging', 'params': {
    'stationId': 'fora072', 'connectorId': 1, 'idTag': 'MOBILE'
  }});
}
```

## Get API Key

Contact server admin. Keys stored in MongoDB `apikeys` collection.

---
**Version**: draft-6 | **Date**: 2025-10-23

