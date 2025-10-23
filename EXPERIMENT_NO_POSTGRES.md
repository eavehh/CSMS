# 🔥 ЭКСПЕРИМЕНТ: Тест fora072 без PostgreSQL

## Цель эксперимента

Проверить, влияет ли PostgreSQL на работу коннекторов станции fora072.

## Что изменено

1. ✅ PostgreSQL **полностью отключен**
2. ✅ StartTransaction - транзакции не сохраняются в БД
3. ✅ StopTransaction - используются mock транзакции
4. ✅ Все данные только в памяти (connectionManager)

## Деплой на сервер 176.88.248.139

```bash
# 1. Подключиться к серверу
ssh root@176.88.248.139

# 2. Перейти в директорию проекта
cd /root/CSMS  # или ваш путь

# 3. Забрать экспериментальную ветку
git fetch origin
git checkout experiment/no-postgres
git pull

# 4. Пересобрать проект
make build

# 5. Остановить PostgreSQL (освободить ресурсы)
docker stop csms-postgres

# 6. Перезапустить сервер
pkill -f "node dist/server/index.js"
nohup node dist/server/index.js > /dev/null 2>&1 &

# 7. Проверить что запустился
ps aux | grep "node dist/server"

# 8. Проверить логи
tail -20 logs/app-$(date +%Y-%m-%d).log
```

## Что должно быть в логах

```
[MONGO] MongoDB connected
[EXPERIMENT] PostgreSQL DISABLED - using in-memory storage only
[HTTP_SERVER] Starting HTTP server...
[MAIN] CSMS Server fully initialized on port 8081
```

## Тест fora072

### 1. Проверить коннекторы через API

```bash
curl http://176.88.248.139:8081/api/stations | python3 -c "
import sys, json
data = json.load(sys.stdin)
fora = next((s for s in data['data'] if s['id'] == 'fora072'), None)
if fora:
    print('fora072:')
    for c in fora['connectors']:
        print(f\"  {c['id']}: {c['status']}\")
"
```

### 2. Проверить через Flutter приложение

- Pull-to-refresh на экране станций
- Проверьте статусы всех 5 коннекторов fora072

### 3. Попробовать зарядку

- Выберите коннектор 0 или 3 (Available)
- Запустите зарядку
- Остановите зарядку
- Проверьте что статус обновился

## Ожидаемые результаты

### Если коннекторы 1, 2, 4 стали Available ✅
**Причина была в PostgreSQL!** Возможные варианты:
- Долгие запросы к БД блокировали обработку StatusNotification
- Проблемы с подключением к PostgreSQL
- Ошибки в Transaction entity

**Решение:** Оптимизировать работу с PostgreSQL или перейти на полностью in-memory.

### Если коннекторы 1, 2, 4 всё ещё Faulted ❌
**Причина в самой станции fora072**, не в сервере.

**Решение:**
- Физическая перезагрузка станции
- Проверка оборудования
- Обращение к производителю

## Откат на main

Если эксперимент завершён:

```bash
cd /root/CSMS
git checkout main
git pull
make build
docker start csms-postgres  # Включить обратно PostgreSQL
pkill -f "node dist/server/index.js"
nohup node dist/server/index.js > /dev/null 2>&1 &
```

## Логи для анализа

```bash
# Смотреть логи в реальном времени
tail -f logs/app-$(date +%Y-%m-%d).log

# Искать упоминания fora072
grep -i fora072 logs/app-$(date +%Y-%m-%d).log | tail -50

# Проверить StatusNotification
grep -E "(StatusNotification.*fora|fora.*StatusNotification)" logs/app-$(date +%Y-%m-%d).log | tail -20
```

---

**Ветка:** `experiment/no-postgres`  
**GitHub:** https://github.com/eavehh/CSMS/tree/experiment/no-postgres
