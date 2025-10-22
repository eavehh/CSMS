# 🚀 Чеклист после деплоя

## 1️⃣ Деплой на сервер

```bash
# Опция A: Через make (рекомендуется)
make deploy

# Опция B: Прямой вызов скрипта
./deploy.sh

# Опция C: Вручную
make build
scp -r dist/ root@176.88.248.139:/root/CSMS/
ssh root@176.88.248.139 "cd /root/CSMS && pkill -f 'node dist/server' && nohup node dist/server/index.js > /dev/null 2>&1 &"
```

## 2️⃣ Проверка логов на сервере

```bash
# Подключиться к серверу
ssh root@176.88.248.139

# Смотреть логи в реальном времени
cd /root/CSMS
tail -f logs/app-$(date +%Y-%m-%d).log

# Или искать упоминания fora072
grep -E "(fora|StatusNotification|Triggering)" logs/app-$(date +%Y-%m-%d).log | tail -50
```

### ✅ Что должно быть в логах:

После переподключения fora072:

```
[CONNECTION] New connection: /fora072
[wsServer] CS added to the connection manager - fora072
[AddConnection] Added connection for fora072 (connectors will be auto-initialized from StatusNotification)
Boot from fora072: Vendor: TestGRPZ, Model: foradc2
[BootNotification] Triggering StatusNotification for fora072
[StatusNotification] fora072 connector 0 - Available
[StatusNotification] fora072 connector 1 - Faulted (error: ...)
[StatusNotification] fora072 connector 2 - Faulted (error: ...)
[StatusNotification] fora072 connector 3 - Available
[StatusNotification] fora072 connector 4 - Faulted (error: ...)
[UpdatedConnector] 0 for fora072: Available
[UpdatedConnector] 1 for fora072: Faulted
[UpdatedConnector] 2 for fora072: Faulted
[UpdatedConnector] 3 for fora072: Available
[UpdatedConnector] 4 for fora072: Faulted
```

### ❌ Чего НЕ должно быть:

```
[connectorManager] cinitializeConnectors: 1 connectors for fora072  # ❌ СТАРЫЙ КОД!
```

## 3️⃣ Проверка API через WebSocket

### Тест из командной строки (Node.js):

```bash
# На локальной машине
node << 'EOF'
const WebSocket = require('ws');
const ws = new WebSocket('ws://176.88.248.139:8081/mobile-client');

ws.on('open', () => {
  console.log('✅ Connected!');
  const request = {
    id: '12345',
    method: 'GET',
    url: '/api/stations'
  };
  ws.send(JSON.stringify(request));
});

ws.on('message', (data) => {
  console.log('📨 Response:', data.toString());
  const response = JSON.parse(data.toString());
  
  // Найти fora072
  const fora = response.data?.find(s => s.id === 'fora072');
  if (fora) {
    console.log('✅ fora072 найдена!');
    console.log(`   Коннекторов: ${fora.connectors?.length || 0}`);
    console.log('   Коннекторы:', fora.connectors);
  } else {
    console.log('❌ fora072 не найдена в ответе');
  }
  
  ws.close();
});

ws.on('error', (e) => console.error('❌ Error:', e));
EOF
```

### Ожидаемый результат:

```json
{
  "id": "12345",
  "status": 200,
  "data": [
    {
      "id": "fora072",
      "name": "Station fora072",
      "status": "PartiallyAvailable",
      "connectors": [
        {"id": 0, "status": "Available", ...},
        {"id": 1, "status": "Faulted", ...},
        {"id": 2, "status": "Faulted", ...},
        {"id": 3, "status": "Available", ...},
        {"id": 4, "status": "Faulted", ...}
      ]
    }
  ]
}
```

## 4️⃣ Проверка Flutter приложения

1. Запустите Flutter приложение
2. Откройте экран со станциями
3. Найдите fora072
4. Проверьте:
   - ✅ Отображается 5 коннекторов (0, 1, 2, 3, 4)
   - ✅ Коннекторы 0 и 3 - Available (зелёные)
   - ✅ Коннекторы 1, 2, 4 - Faulted (красные)
   - ✅ Нет ошибки "unknown Error"
   - ✅ Можно начать зарядку на коннекторах 0 или 3

## 5️⃣ Тест полного цикла зарядки

1. Выберите станцию fora072
2. Выберите коннектор 3 (Available)
3. Нажмите "Start Charging"
4. Проверьте логи сервера:
```
[StartTransaction] fora072 connector 3 started by user123
[UpdatedConnector] 3 for fora072: Charging (transaction id: ...)
```
5. Нажмите "Stop Charging"
6. Проверьте логи:
```
[StopTransaction] ===== START ===== chargePointId=fora072
[StopTransaction] Found tx: id=..., connectorId=3, chargePointId=fora072
[StopTransaction] Metrics: totalWh=..., totalKWh=..., cost=...
[StopTransaction] Set connector 3 to Finishing state
[StopTransaction] Connector 3 on fora072 reset to Available
[StopTransaction] ===== END (success) =====
```

## 🐛 Если что-то не работает:

### Проблема: fora072 показывает 0 коннекторов

**Причина:** Сервер не перезапущен или TriggerMessage не сработал

**Решение:**
```bash
# На сервере
pkill -f "node dist/server"
cd /root/CSMS
node dist/server/index.js &

# Перезагрузите станцию fora072 или дождитесь переподключения
```

### Проблема: "unknown Error" на frontend

**Причина:** API возвращает некорректный JSON

**Решение:** Проверьте ответ API вручную (см. тест выше)

### Проблема: TriggerMessage не отправляется

**Причина:** Станция может не поддерживать TriggerMessage

**Решение:** Проверьте логи:
```bash
grep "TriggerMessage" logs/app-$(date +%Y-%m-%d).log
```

Если в логах есть ошибка от станции, нужно будет инициализировать коннекторы по-другому.

## 📞 Контакты для поддержки

- Сервер: 176.88.248.139:8081
- WebSocket path: `/mobile-client` (Flutter)
- WebSocket path: `/<chargePointId>` (OCPP станции)
- Логи: `/root/CSMS/logs/app-YYYY-MM-DD.log`
