# ✅ Упрощен API для остановки транзакций

## 🎯 Проблема

Фронтенд не мог использовать кнопку "Stop" для коннектора, так как не знал `transactionId`.

## ✨ Решение

Сделал `transactionId` **опциональным** в `/api/admin/remote-stop-session`. Теперь достаточно передать только `chargePointId` и `connectorId` - сервер сам найдет активную транзакцию!

## 📝 Что изменилось

### Файл: `src/api/apiHandlers/transactionsApi.ts`

**Функция `stopRemoteTrx` теперь:**
1. Принимает `transactionId` как **опциональный** параметр
2. Если `transactionId` не передан - автоматически находит его через `connectionManager.getConnectorState()`
3. Возвращает `transactionId` в ответе для информации

## 🚀 Использование на фронтенде

### Было (сложно):
```javascript
// ❌ Нужно было знать transactionId
POST /api/admin/remote-stop-session
{
  "chargePointId": "CP001",
  "connectorId": 1,
  "transactionId": "1734567890123" // Откуда взять?
}
```

### Стало (просто):
```javascript
// ✅ Достаточно станции и коннектора!
POST /api/admin/remote-stop-session
{
  "chargePointId": "CP001",
  "connectorId": 1
  // transactionId автоматически найдется
}
```

## 💻 Пример кода

### React компонент
```jsx
const handleStop = async () => {
  const response = await fetch('/api/admin/remote-stop-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chargePointId: 'CP001',
      connectorId: 1
      // transactionId НЕ нужен!
    })
  });
  
  const data = await response.json();
  console.log(`Stopped transaction: ${data.transactionId}`);
};
```

### Flutter
```dart
final response = await http.post(
  Uri.parse('http://localhost:8081/api/admin/remote-stop-session'),
  body: json.encode({
    'chargePointId': 'CP001',
    'connectorId': 1,
    // transactionId НЕ нужен!
  }),
);
```

## ✅ Преимущества

✅ Фронтенду не нужно хранить `transactionId`  
✅ Кнопка "Stop" привязана к коннектору, а не к транзакции  
✅ Меньше ошибок в UI логике  
✅ Обратная совместимость - можно передать `transactionId` вручную  

## 📚 Документация

**Полная документация:** [SIMPLIFIED_TRANSACTION_API.md](./SIMPLIFIED_TRANSACTION_API.md)

Содержит:
- Подробное API описание
- Примеры для React, Flutter, Vanilla JS
- Логику работы
- Тестирование

## 🧪 Тестирование

```bash
# Запустить транзакцию
curl -X POST http://localhost:8081/api/admin/remote-start-session \
  -H "Content-Type: application/json" \
  -d '{"chargePointId":"CP001","connectorId":1,"idTag":"USER123"}'

# Остановить (без transactionId!)
curl -X POST http://localhost:8081/api/admin/remote-stop-session \
  -H "Content-Type: application/json" \
  -d '{"chargePointId":"CP001","connectorId":1}'

# Ответ:
# {"success":true,"message":"RemoteStopTransaction sent via WebSocket","transactionId":"123"}
```

## 📁 Измененные файлы

- ✅ `src/api/apiHandlers/transactionsApi.ts` - `stopRemoteTrx` с автопоиском transactionId

## 🎉 Готово!

Теперь фронтенд может просто отправлять запросы с `chargePointId` и `connectorId` - никаких проблем с `transactionId`!
