# Cross-platform Makefile to run DBs (PostgreSQL + MongoDB), build and run the project
# Requirements on Windows: Docker Desktop + Git Bash (or any make-capable shell)

# Config (override via environment or make VAR=value)
POSTGRES_IMAGE ?= postgres:14
MONGO_IMAGE ?= mongo:6
PG_CONTAINER ?= csms-postgres
MONGO_CONTAINER ?= csms-mongo
PG_PORT ?= 5432
MONGO_PORT ?= 27017
PG_DB ?= csms
PG_USER ?= db_user
PG_PASSWORD ?= db_password
PG_VOLUME ?= csms_pgdata
MONGO_VOLUME ?= csms_mongo

.PHONY: help up-db wait-postgres init-db db-start build start start-bg logs test e2e stop down clean status deps deps-quick setup

help:
	@echo "Commands:"
	@echo "  make setup        - full setup: install deps + start db + build"
	@echo "  make deps         - install all Node.js dependencies"
	@echo "  make deps-quick   - install only frequently needed packages for Ubuntu"
	@echo "  make db-start     - start Postgres+Mongo in Docker and init csms DB/user"
	@echo "  make build        - compile TS and copy schemas to dist"
	@echo "  make start        - run server in foreground"
	@echo "  make start-bg     - run server in background (nohup)"
	@echo "  make logs         - tail today's app log if present"
	@echo "  make test         - run HTTP test script against running server"
	@echo "  make stop         - stop DB containers"
	@echo "  make down         - remove DB containers (keeps volumes)"
	@echo "  make clean        - remove containers and volumes"
	@echo "  make status       - show docker container status"
# --- Databases ---
up-db:
	@echo "[DB] Starting PostgreSQL ($(POSTGRES_IMAGE)) on port $(PG_PORT)"
	-@docker inspect $(PG_CONTAINER) >/dev/null 2>&1 || \
		docker run -d --name $(PG_CONTAINER) \
		  -e POSTGRES_PASSWORD=$(PG_PASSWORD) \
		  -p $(PG_PORT):5432 \
		  -v $(PG_VOLUME):/var/lib/postgresql/data \
		  $(POSTGRES_IMAGE)
	@docker start $(PG_CONTAINER) >/dev/null 2>&1 || true
	@echo "[DB] Starting MongoDB ($(MONGO_IMAGE)) on port $(MONGO_PORT)"
	-@docker inspect $(MONGO_CONTAINER) >/dev/null 2>&1 || \
		docker run -d --name $(MONGO_CONTAINER) \
		  -p $(MONGO_PORT):27017 \
		  -v $(MONGO_VOLUME):/data/db \
		  $(MONGO_IMAGE)
	@docker start $(MONGO_CONTAINER) >/dev/null 2>&1 || true

wait-postgres:
	@echo "[DB] Waiting for PostgreSQL to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
	  docker exec -u postgres $(PG_CONTAINER) pg_isready -U postgres >/dev/null 2>&1 && break; \
	  echo "  - retry $$i"; \
	  sleep 2; \
	 done

init-db: wait-postgres
	@echo "[DB] Creating role $(PG_USER) and database $(PG_DB) if not exists..."
	@docker exec -u postgres $(PG_CONTAINER) psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$(PG_USER)'" | grep -q 1 || \
	  docker exec -u postgres $(PG_CONTAINER) psql -U postgres -c "CREATE USER $(PG_USER) WITH PASSWORD '$(PG_PASSWORD)';"
	@docker exec -u postgres $(PG_CONTAINER) psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$(PG_DB)'" | grep -q 1 || \
	  docker exec -u postgres $(PG_CONTAINER) psql -U postgres -c "CREATE DATABASE $(PG_DB);"
	@docker exec -u postgres $(PG_CONTAINER) psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $(PG_DB) TO $(PG_USER);"

db-start: up-db init-db
	@echo "[DB] PostgreSQL and MongoDB are up. DB=$(PG_DB) USER=$(PG_USER)"

status:
	@docker ps -a --filter "name=$(PG_CONTAINER)|$(MONGO_CONTAINER)"

stop:
	-@docker stop $(PG_CONTAINER) >/dev/null 2>&1 || true
	-@docker stop $(MONGO_CONTAINER) >/dev/null 2>&1 || true
	@echo "[DB] Containers stopped."

down:
	-@docker rm -f $(PG_CONTAINER) >/dev/null 2>&1 || true
	-@docker rm -f $(MONGO_CONTAINER) >/dev/null 2>&1 || true
	@echo "[DB] Containers removed. Volumes preserved."

clean: down
	-@docker volume rm $(PG_VOLUME) >/dev/null 2>&1 || true
	-@docker volume rm $(MONGO_VOLUME) >/dev/null 2>&1 || true
	@echo "[DB] Volumes removed."

# --- Build & Run ---
build:
	@echo "[BUILD] Compiling TypeScript..."
	npx tsc
	@echo "[BUILD] Copying JSON schemas..."
	npm run copy-schemas
	@echo "[BUILD] Done."

start:
	@echo "[RUN] Starting server (foreground)..."
	node dist/server/index.js

start-bg:
	@echo "[RUN] Starting server (background via nohup)..."
	nohup node dist/server/index.js >/dev/null 2>&1 & echo $$! > .server.pid && echo "PID $$(cat .server.pid)"

logs:
	@LOG_FILE=logs/app-$$(date +%Y-%m-%d).log; \
	if [ -f $$LOG_FILE ]; then echo "[LOGS] Tailing $$LOG_FILE"; tail -f $$LOG_FILE; else echo "[LOGS] No log for today: $$LOG_FILE"; fi

test:
	@echo "[TEST] Running test_db.js against http://localhost:8081 ..."
	node dist/server/test_db.js

e2e: build
	@echo "[E2E] Running end-to-end tests..."
	node dist/server/test_db.js

# --- Dependencies & Setup ---
deps:
	@echo "[DEPS] Installing Node.js dependencies..."
	@echo "[DEPS] Installing main dependencies..."
	npm install
	@echo "[DEPS] Installing specific versions for Ubuntu compatibility..."
	npm install node-fetch@2
	npm install chalk@4
	npm install uuid@8.3.2
	npm install @types/uuid@8
	npm install winston@3.8.2
	npm install winston-daily-rotate-file@4.7.1
	npm install ws@8.13.0
	npm install @types/ws@8.5.4
	npm install express@4.18.2
	npm install @types/express@4.17.17
	npm install typescript@5.0.4
	npm install ts-node@10.9.1
	npm install mongoose@7.4.0
	npm install typeorm@0.3.17
	npm install pg@8.11.0
	npm install reflect-metadata@0.1.13
	npm install ajv@8.12.0
	npm install ajv-formats@2.1.1
	@echo "[DEPS] All dependencies installed successfully!"

deps-quick:
	@echo "[DEPS-QUICK] Installing only frequently needed packages for Ubuntu..."
	npm install node-fetch@2
	npm install chalk@4
	npm install uuid@8.3.2
	npm install winston@3.8.2
	npm install winston-daily-rotate-file@4.7.1
	@echo "[DEPS-QUICK] Quick dependencies installed!"

setup: deps db-start build
	@echo "[SETUP] Full setup complete! Ready to run 'make start'."


