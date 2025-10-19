the dirictory types is not changed manually
there are script scripts/generate-types.js

## 🆕 Recent Transactions API

Новый endpoint для получения последних транзакций с объединенными данными start и stop.

### Quick Start

```bash
# Получить последние 10 транзакций
curl http://localhost:8081/api/transactions/recent

# Получить последние 5 транзакций
curl http://localhost:8081/api/transactions/recent?limit=5
```

### Features

✅ Объединенные данные StartTransaction + StopTransaction в одном объекте  
✅ Быстрый доступ к последним транзакциям (in-memory)  
✅ Автоматическая синхронизация статусов (Started → Completed)  
✅ Готовые примеры интеграции для фронтенда  
✅ Тестовые скрипты для проверки работы  
