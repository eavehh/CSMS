# CSMS WebSocket API - Dart/Flutter

## Быстрая установка

```yaml
# pubspec.yaml
dependencies:
  web_socket_channel: ^2.4.0
  uuid: ^4.0.0
```

## Класс API

```dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';
import 'dart:convert';
import 'dart:async';

class CSMSAPI {
  late WebSocketChannel _channel;
  final Map<String, Completer<Map<String, dynamic>>> _requests = {};
  final Uuid _uuid = const Uuid();
  
  Future<void> connect() async {
    _channel = WebSocketChannel.connect(
      Uri.parse('ws://193.29.139.202:8081/mobile-client'),
    );
    
    _channel.stream.listen((data) {
      final response = json.decode(data) as Map<String, dynamic>;
      final id = response['id'] as String?;
      if (id != null && _requests.containsKey(id)) {
        _requests[id]!.complete(response);
        _requests.remove(id);
      }
    });
  }
  
  Future<Map<String, dynamic>> _send(String method, String url, [Map<String, dynamic>? data]) async {
    final id = _uuid.v4();
    final request = {'id': id, 'method': method, 'url': url};
    if (data != null) request['data'] = data;
    
    final completer = Completer<Map<String, dynamic>>();
    _requests[id] = completer;
    
    _channel.sink.add(json.encode(request));
    return completer.future.timeout(Duration(seconds: 30));
  }
}
```

## Примеры запросов

### 1. Получить список станций

```dart
final api = CSMSAPI();
await api.connect();

final response = await api._send('GET', '/api/stations');
if (response['status'] == 200) {
  final stations = response['data']['data'] as List;
  print('Найдено станций: ${stations.length}');
}
```

### 2. Начать зарядку

```dart
final response = await api._send('POST', '/api/stations/station-001/start', {
  'connectorId': 1,
  'idTag': 'user-card-123'
});

if (response['status'] == 200) {
  final transactionId = response['data']['transactionId'];
  print('Зарядка началась. ID: $transactionId');
}
```

### 3. Остановить зарядку

```dart
final response = await api._send('POST', '/api/stations/station-001/stop', {
  'transactionId': 123456
});

if (response['status'] == 200) {
  print('Зарядка остановлена');
}
```

## Формат ответов

Все ответы имеют структуру:

```dart
{
  "id": "request-id",
  "status": 200,           // HTTP код
  "data": {                // Данные при успехе
    "success": true,
    "data": [...]
  },
  "error": "message"       // Ошибка при неудаче
}
```

## Пример использования в Flutter

```dart
class StationScreen extends StatefulWidget {
  @override
  _StationScreenState createState() => _StationScreenState();
}

class _StationScreenState extends State<StationScreen> {
  final CSMSAPI api = CSMSAPI();
  List<Map<String, dynamic>> stations = [];
  
  @override
  void initState() {
    super.initState();
    _init();
  }
  
  Future<void> _init() async {
    await api.connect();
    await _loadStations();
  }
  
  Future<void> _loadStations() async {
    try {
      final response = await api._send('GET', '/api/stations');
      if (response['status'] == 200) {
        setState(() {
          stations = List<Map<String, dynamic>>.from(response['data']['data']);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ошибка: $e')),
      );
    }
  }
  
  Future<void> _startCharging(String stationId) async {
    try {
      final response = await api._send('POST', '/api/stations/$stationId/start', {
        'connectorId': 1,
        'idTag': 'user-card'
      });
      
      if (response['status'] == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Зарядка запущена!')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ошибка: $e')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Станции')),
      body: ListView.builder(
        itemCount: stations.length,
        itemBuilder: (context, index) {
          final station = stations[index];
          return ListTile(
            title: Text(station['name']),
            subtitle: Text('Статус: ${station['status']}'),
            trailing: ElevatedButton(
              onPressed: () => _startCharging(station['id']),
              child: Text('Старт'),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _loadStations,
        child: Icon(Icons.refresh),
      ),
    );
  }
}
```

## Доступные endpoints

### `GET /api/stations` - список станций

**Запрос:**
```json
{
  "id": "req-1",
  "method": "GET",
  "url": "/api/stations"
}
```

**Ответ:**
```json
{
  "id": "req-1",
  "status": 200,
  "data": {
    "success": true,
    "data": [
      {
        "id": "station-001",
        "name": "station-001",
        "status": "Available",
        "isOnline": true,
        "lastActivity": "2025-10-22T20:52:00.000Z",
        "connectors": [
          {
            "id": 1,
            "status": "Available"
          }
        ]
      }
    ]
  }
}
```

### `POST /api/stations/{id}/start` - начать зарядку

**Запрос:**
```json
{
  "id": "req-2",
  "method": "POST",
  "url": "/api/stations/station-001/start",
  "data": {
    "connectorId": 1,
    "idTag": "user-card-123"
  }
}
```

**Ответ:**
```json
{
  "id": "req-2",
  "status": 200,
  "data": {
    "success": true,
    "message": "Start command sent to station-001",
    "transactionId": 123456
  }
}
```

### `POST /api/stations/{id}/stop` - остановить зарядку

**Запрос:**
```json
{
  "id": "req-3",
  "method": "POST",
  "url": "/api/stations/station-001/stop",
  "data": {
    "transactionId": 123456
  }
}
```

**Ответ:**
```json
{
  "id": "req-3",
  "status": 200,
  "data": {
    "success": true,
    "message": "Stop command sent to station-001"
  }
}
```

**Сервер:** `ws://193.29.139.202:8081/mobile-client`