# 🎯 Упрощенный API для управления транзакциями на фронтенде

## Проблема (было)

Раньше для остановки транзакции фронтенд должен был передавать `transactionId`:

```javascript
// ❌ Сложно - фронт не знает transactionId
POST /api/admin/remote-stop-session
{
  "chargePointId": "CP001",
  "connectorId": 1,
  "transactionId": "???" // Откуда взять?
}
```

## Решение (стало)

Теперь `transactionId` **опционален**! Сервер сам находит активную транзакцию по коннектору:

```javascript
// ✅ Просто - достаточно знать станцию и коннектор
POST /api/admin/remote-stop-session
{
  "chargePointId": "CP001",
  "connectorId": 1
  // transactionId автоматически определится
}
```

## 📡 API Reference

### 1. Запуск транзакции

**Endpoint:** `POST /api/admin/remote-start-session`

**Body:**
```json
{
  "chargePointId": "CP001",
  "connectorId": 1,
  "idTag": "USER123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "RemoteStartTransaction sent via WebSocket"
}
```

### 2. Остановка транзакции (упрощенная)

**Endpoint:** `POST /api/admin/remote-stop-session`

**Body (только станция и коннектор):**
```json
{
  "chargePointId": "CP001",
  "connectorId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "RemoteStopTransaction sent via WebSocket",
  "transactionId": "1734567890123"
}
```

**Опционально можно передать transactionId вручную:**
```json
{
  "chargePointId": "CP001",
  "connectorId": 1,
  "transactionId": "1734567890123"
}
```

## 💻 Примеры для фронтенда

### React - Кнопки Start/Stop для коннектора

```jsx
import React, { useState } from 'react';

function ConnectorControl({ chargePointId, connectorId }) {
  const [isCharging, setIsCharging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8081/api/admin/remote-start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargePointId,
          connectorId,
          idTag: 'USER123' // ID пользователя
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsCharging(true);
        alert('Зарядка запущена!');
      } else {
        alert('Ошибка запуска');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка запуска зарядки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8081/api/admin/remote-stop-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargePointId,
          connectorId
          // transactionId НЕ нужен!
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsCharging(false);
        alert(`Зарядка остановлена! (Transaction ID: ${data.transactionId})`);
      } else {
        alert(data.error || 'Ошибка остановки');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка остановки зарядки');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="connector-control">
      <h3>Connector {connectorId}</h3>
      <div className="buttons">
        {!isCharging ? (
          <button 
            onClick={handleStart} 
            disabled={isLoading}
            className="btn btn-success"
          >
            {isLoading ? '⏳ Запуск...' : '▶️ Начать зарядку'}
          </button>
        ) : (
          <button 
            onClick={handleStop} 
            disabled={isLoading}
            className="btn btn-danger"
          >
            {isLoading ? '⏳ Остановка...' : '⏹️ Остановить зарядку'}
          </button>
        )}
      </div>
      {isCharging && (
        <div className="status">
          <span className="badge charging">Идет зарядка</span>
        </div>
      )}
    </div>
  );
}

export default ConnectorControl;
```

### Flutter/Dart - Кнопки для коннектора

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ConnectorControl extends StatefulWidget {
  final String chargePointId;
  final int connectorId;

  const ConnectorControl({
    Key? key,
    required this.chargePointId,
    required this.connectorId,
  }) : super(key: key);

  @override
  State<ConnectorControl> createState() => _ConnectorControlState();
}

class _ConnectorControlState extends State<ConnectorControl> {
  bool isCharging = false;
  bool isLoading = false;

  Future<void> startCharging() async {
    setState(() => isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('http://localhost:8081/api/admin/remote-start-session'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'chargePointId': widget.chargePointId,
          'connectorId': widget.connectorId,
          'idTag': 'USER123', // ID пользователя
        }),
      );

      final data = json.decode(response.body);

      if (data['success'] == true) {
        setState(() => isCharging = true);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Зарядка запущена!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Ошибка: ${data['error']}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка запуска: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  Future<void> stopCharging() async {
    setState(() => isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('http://localhost:8081/api/admin/remote-stop-session'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'chargePointId': widget.chargePointId,
          'connectorId': widget.connectorId,
          // transactionId НЕ нужен!
        }),
      );

      final data = json.decode(response.body);

      if (data['success'] == true) {
        setState(() => isCharging = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Зарядка остановлена! (TX: ${data['transactionId']})'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Ошибка: ${data['error']}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка остановки: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Connector ${widget.connectorId}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            if (!isCharging)
              ElevatedButton.icon(
                onPressed: isLoading ? null : startCharging,
                icon: isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.play_arrow),
                label: Text(isLoading ? 'Запуск...' : 'Начать зарядку'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: isLoading ? null : stopCharging,
                icon: isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.stop),
                label: Text(isLoading ? 'Остановка...' : 'Остановить зарядку'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
              ),
            if (isCharging) ...[
              const SizedBox(height: 8),
              const Chip(
                label: Text('Идет зарядка'),
                backgroundColor: Colors.green,
                labelStyle: TextStyle(color: Colors.white),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Использование:
// ConnectorControl(
//   chargePointId: 'CP001',
//   connectorId: 1,
// )
```

### Vanilla JavaScript - Простейший вариант

```javascript
class ConnectorButtons {
  constructor(chargePointId, connectorId, containerId) {
    this.chargePointId = chargePointId;
    this.connectorId = connectorId;
    this.container = document.getElementById(containerId);
    this.isCharging = false;
    
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="connector-control">
        <h3>Connector ${this.connectorId}</h3>
        <button id="start-btn-${this.connectorId}" class="btn btn-success">
          ▶️ Начать зарядку
        </button>
        <button id="stop-btn-${this.connectorId}" class="btn btn-danger" style="display:none;">
          ⏹️ Остановить зарядку
        </button>
        <div id="status-${this.connectorId}" class="status"></div>
      </div>
    `;

    document.getElementById(`start-btn-${this.connectorId}`)
      .addEventListener('click', () => this.startCharging());
    
    document.getElementById(`stop-btn-${this.connectorId}`)
      .addEventListener('click', () => this.stopCharging());
  }

  async startCharging() {
    const startBtn = document.getElementById(`start-btn-${this.connectorId}`);
    const stopBtn = document.getElementById(`stop-btn-${this.connectorId}`);
    const status = document.getElementById(`status-${this.connectorId}`);

    startBtn.disabled = true;
    startBtn.textContent = '⏳ Запуск...';

    try {
      const response = await fetch('http://localhost:8081/api/admin/remote-start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargePointId: this.chargePointId,
          connectorId: this.connectorId,
          idTag: 'USER123'
        })
      });

      const data = await response.json();

      if (data.success) {
        this.isCharging = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        status.innerHTML = '<span class="badge charging">Идет зарядка</span>';
        alert('Зарядка запущена!');
      } else {
        alert('Ошибка запуска');
      }
    } catch (error) {
      alert('Ошибка запуска зарядки');
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = '▶️ Начать зарядку';
    }
  }

  async stopCharging() {
    const startBtn = document.getElementById(`start-btn-${this.connectorId}`);
    const stopBtn = document.getElementById(`stop-btn-${this.connectorId}`);
    const status = document.getElementById(`status-${this.connectorId}`);

    stopBtn.disabled = true;
    stopBtn.textContent = '⏳ Остановка...';

    try {
      const response = await fetch('http://localhost:8081/api/admin/remote-stop-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargePointId: this.chargePointId,
          connectorId: this.connectorId
          // transactionId НЕ нужен!
        })
      });

      const data = await response.json();

      if (data.success) {
        this.isCharging = false;
        stopBtn.style.display = 'none';
        startBtn.style.display = 'inline-block';
        status.innerHTML = '';
        alert(`Зарядка остановлена! (Transaction: ${data.transactionId})`);
      } else {
        alert(data.error || 'Ошибка остановки');
      }
    } catch (error) {
      alert('Ошибка остановки зарядки');
    } finally {
      stopBtn.disabled = false;
      stopBtn.textContent = '⏹️ Остановить зарядку';
    }
  }
}

// Использование:
// new ConnectorButtons('CP001', 1, 'connector-1-container');
// new ConnectorButtons('CP001', 2, 'connector-2-container');
```

## 🎯 Преимущества нового подхода

✅ **Проще для фронтенда** - не нужно хранить и передавать `transactionId`  
✅ **Меньше ошибок** - сервер сам находит активную транзакцию  
✅ **Логичнее** - кнопка "Stop" работает для коннектора, а не для транзакции  
✅ **Обратная совместимость** - можно передать `transactionId` вручную если нужно  

## ⚠️ Важные замечания

1. **Для остановки нужна активная транзакция**
   - Если на коннекторе нет активной транзакции, получите ошибку
   
2. **Один коннектор = одна транзакция**
   - На одном коннекторе может быть только одна активная транзакция
   
3. **Автоопределение transactionId**
   - Сервер берет `transactionId` из `connectionManager.getConnectorState()`

## 🧪 Тестирование

```bash
# 1. Запустить транзакцию
curl -X POST http://localhost:8081/api/admin/remote-start-session \
  -H "Content-Type: application/json" \
  -d '{
    "chargePointId": "CP001",
    "connectorId": 1,
    "idTag": "USER123"
  }'

# 2. Остановить транзакцию (без transactionId!)
curl -X POST http://localhost:8081/api/admin/remote-stop-session \
  -H "Content-Type: application/json" \
  -d '{
    "chargePointId": "CP001",
    "connectorId": 1
  }'

# Ответ:
# {
#   "success": true,
#   "message": "RemoteStopTransaction sent via WebSocket",
#   "transactionId": "1734567890123"
# }
```

## 📝 Логика работы

```
1. Фронтенд нажимает "Start" на коннекторе
   ↓
2. POST /api/admin/remote-start-session {chargePointId, connectorId, idTag}
   ↓
3. Сервер отправляет RemoteStartTransaction станции
   ↓
4. Станция начинает зарядку и отправляет StartTransaction
   ↓
5. Сервер сохраняет transactionId в connectionManager для этого коннектора
   ↓
6. Фронтенд нажимает "Stop" на том же коннекторе
   ↓
7. POST /api/admin/remote-stop-session {chargePointId, connectorId}
   ↓
8. Сервер находит transactionId через connectionManager.getConnectorState()
   ↓
9. Сервер отправляет RemoteStopTransaction станции
   ↓
10. Станция останавливает зарядку
```

---

**Дата обновления:** 19 октября 2025  
**Версия:** 2.0 (упрощенная)  
**Статус:** ✅ Готово к использованию
