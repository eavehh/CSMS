Param(
    [Parameter(Position=0)] [string]$Task = 'help'
)

$ErrorActionPreference = 'Stop'

# Config (override via env: $env:PG_PORT, etc.)
$POSTGRES_IMAGE = $env:POSTGRES_IMAGE; if (-not $POSTGRES_IMAGE) { $POSTGRES_IMAGE = 'postgres:14' }
$MONGO_IMAGE    = $env:MONGO_IMAGE;    if (-not $MONGO_IMAGE)    { $MONGO_IMAGE    = 'mongo:6' }
$PG_CONTAINER   = $env:PG_CONTAINER;   if (-not $PG_CONTAINER)   { $PG_CONTAINER   = 'csms-postgres' }
$MONGO_CONTAINER= $env:MONGO_CONTAINER;if (-not $MONGO_CONTAINER){ $MONGO_CONTAINER= 'csms-mongo' }
$PG_PORT        = $env:PG_PORT;        if (-not $PG_PORT)        { $PG_PORT        = 5432 }
$MONGO_PORT     = $env:MONGO_PORT;     if (-not $MONGO_PORT)     { $MONGO_PORT     = 27017 }
$PG_DB          = $env:PG_DB;          if (-not $PG_DB)          { $PG_DB          = 'csms' }
$PG_USER        = $env:PG_USER;        if (-not $PG_USER)        { $PG_USER        = 'db_user' }
$PG_PASSWORD    = $env:PG_PASSWORD;    if (-not $PG_PASSWORD)    { $PG_PASSWORD    = 'db_password' }
$PG_VOLUME      = $env:PG_VOLUME;      if (-not $PG_VOLUME)      { $PG_VOLUME      = 'csms_pgdata' }
$MONGO_VOLUME   = $env:MONGO_VOLUME;   if (-not $MONGO_VOLUME)   { $MONGO_VOLUME   = 'csms_mongo' }

function Exec([string]$cmd) {
    Write-Host "> $cmd" -ForegroundColor DarkGray
    $global:LASTEXITCODE = 0
    powershell -NoLogo -NoProfile -Command $cmd
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd" }
}

function Up-Db {
    Write-Host "[DB] Starting PostgreSQL ($POSTGRES_IMAGE) on port $PG_PORT"
    docker inspect $PG_CONTAINER *> $null
    if ($LASTEXITCODE -ne 0) {
        Exec "docker run -d --name $PG_CONTAINER -e POSTGRES_PASSWORD=$PG_PASSWORD -p $PG_PORT`:5432 -v $PG_VOLUME`:/var/lib/postgresql/data $POSTGRES_IMAGE"
    }
    docker start $PG_CONTAINER *> $null | Out-Null

    Write-Host "[DB] Starting MongoDB ($MONGO_IMAGE) on port $MONGO_PORT"
    docker inspect $MONGO_CONTAINER *> $null
    if ($LASTEXITCODE -ne 0) {
        Exec "docker run -d --name $MONGO_CONTAINER -p $MONGO_PORT`:27017 -v $MONGO_VOLUME`:/data/db $MONGO_IMAGE"
    }
    docker start $MONGO_CONTAINER *> $null | Out-Null
}

function Wait-Postgres {
    Write-Host "[DB] Waiting for PostgreSQL to be ready..."
    for ($i=1; $i -le 10; $i++) {
        docker exec -u postgres $PG_CONTAINER pg_isready -U postgres *> $null
        if ($LASTEXITCODE -eq 0) { return }
        Write-Host "  - retry $i"
        Start-Sleep -Seconds 2
    }
    throw "PostgreSQL did not become ready"
}

function Init-Db {
    Wait-Postgres
    Write-Host "[DB] Creating role $PG_USER and database $PG_DB if not exists..."
    $roleCheck = docker exec -u postgres $PG_CONTAINER psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | Out-String
    if (-not ($roleCheck.Trim() -eq '1')) {
        Exec "docker exec -u postgres $PG_CONTAINER psql -U postgres -c \"CREATE USER $PG_USER WITH PASSWORD '$PG_PASSWORD';\""
    }
    $dbCheck = docker exec -u postgres $PG_CONTAINER psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | Out-String
    if (-not ($dbCheck.Trim() -eq '1')) {
        Exec "docker exec -u postgres $PG_CONTAINER psql -U postgres -c \"CREATE DATABASE $PG_DB;\""
    }
    Exec "docker exec -u postgres $PG_CONTAINER psql -U postgres -c \"GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;\""
}

function Db-Start {
    Up-Db
    Init-Db
    Write-Host "[DB] PostgreSQL and MongoDB are up. DB=$PG_DB USER=$PG_USER"
}

function Status {
    Exec "docker ps -a --filter \"name=$PG_CONTAINER|$MONGO_CONTAINER\""
}

function Stop-Db {
    docker stop $PG_CONTAINER *> $null | Out-Null
    docker stop $MONGO_CONTAINER *> $null | Out-Null
    Write-Host "[DB] Containers stopped."
}

function Down-Db {
    docker rm -f $PG_CONTAINER *> $null | Out-Null
    docker rm -f $MONGO_CONTAINER *> $null | Out-Null
    Write-Host "[DB] Containers removed. Volumes preserved."
}

function Clean-Db {
    Down-Db
    docker volume rm $PG_VOLUME *> $null | Out-Null
    docker volume rm $MONGO_VOLUME *> $null | Out-Null
    Write-Host "[DB] Volumes removed."
}

function Build {
    Write-Host "[BUILD] Compiling TypeScript..."
    Exec "npx tsc"
    Write-Host "[BUILD] Copying JSON schemas..."
    Exec "npm run copy-schemas"
    Write-Host "[BUILD] Done."
}

function Start-Server {
    Write-Host "[RUN] Starting server (foreground)..."
    Exec "node dist/server/index.js"
}

function Start-ServerBg {
    Write-Host "[RUN] Starting server (background)..."
    Start-Process -FilePath node -ArgumentList 'dist/server/index.js' -WindowStyle Hidden
}

function Logs {
    $log = Join-Path 'logs' ("app-" + (Get-Date -Format 'yyyy-MM-dd') + ".log")
    if (Test-Path $log) {
        Write-Host "[LOGS] Tailing $log"
        Get-Content -Path $log -Wait
    } else {
        Write-Host "[LOGS] No log for today: $log"
    }
}

function Test-E2E {
    Write-Host "[TEST] Running test_db.js against http://localhost:8081 ..."
    Exec "node dist/server/test_db.js"
}

function E2E {
    Build
    Write-Host "[E2E] Running end-to-end tests..."
    Exec "node dist/server/test_db.js"
}

function Help {
    @(
        'Commands:',
        '  .\\make.win.ps1 db-start     - start Postgres+Mongo in Docker and init csms DB/user',
        '  .\\make.win.ps1 build        - compile TS and copy schemas to dist',
        '  .\\make.win.ps1 start        - run server (foreground)',
        '  .\\make.win.ps1 start-bg     - run server (background)',
        '  .\\make.win.ps1 logs         - tail today log if present',
        '  .\\make.win.ps1 test         - run E2E script against server',
        '  .\\make.win.ps1 e2e          - build then run E2E',
        '  .\\make.win.ps1 stop         - stop DB containers',
        '  .\\make.win.ps1 down         - remove DB containers (keep volumes)',
        '  .\\make.win.ps1 clean        - remove containers and volumes',
        '  .\\make.win.ps1 status       - show docker container status'
    ) | ForEach-Object { Write-Host $_ }
}

try {
    switch ($Task) {
        'help'      { Help }
        'up-db'     { Up-Db }
        'wait-postgres' { Wait-Postgres }
        'init-db'   { Init-Db }
        'db-start'  { Db-Start }
        'status'    { Status }
        'stop'      { Stop-Db }
        'down'      { Down-Db }
        'clean'     { Clean-Db }
        'build'     { Build }
        'start'     { Start-Server }
        'start-bg'  { Start-ServerBg }
        'logs'      { Logs }
        'test'      { Test-E2E }
        'e2e'       { E2E }
        Default     { Write-Host "Unknown task '$Task'" -ForegroundColor Red; Help; exit 1 }
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

