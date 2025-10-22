#!/bin/bash
# Скрипт автоматического деплоя на сервер 176.88.248.139

# ============================================
# НАСТРОЙКИ - ИЗМЕНИТЕ ПОД СЕБЯ
# ============================================
SERVER_IP="176.88.248.139"
SERVER_USER="root"  # Измените на своего пользователя (root, ubuntu, ab и т.д.)
SERVER_PORT="22"    # Измените если SSH на другом порту (например 2222)
REMOTE_PATH="/root/CSMS"  # Измените на путь к проекту на сервере

# ============================================
# ДЕПЛОЙ
# ============================================

echo "🔨 [1/5] Building project..."
make build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "📦 [2/5] Uploading dist/ to server..."
scp -P $SERVER_PORT -r dist/ $SERVER_USER@$SERVER_IP:$REMOTE_PATH/
if [ $? -ne 0 ]; then
    echo "❌ Upload failed! Check SSH settings."
    exit 1
fi

echo ""
echo "🔄 [3/5] Restarting server..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'EOF'
    cd /root/CSMS
    echo "Killing old process..."
    pkill -f "node dist/server/index.js" || true
    sleep 2
    echo "Starting new process..."
    nohup node dist/server/index.js > /dev/null 2>&1 &
    echo "Server restarted with PID: $!"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Restart failed!"
    exit 1
fi

echo ""
echo "📊 [4/5] Checking logs..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'EOF'
    cd /root/CSMS
    LOG_FILE="logs/app-$(date +%Y-%m-%d).log"
    if [ -f "$LOG_FILE" ]; then
        echo "Last 20 lines of today's log:"
        tail -20 "$LOG_FILE"
    else
        echo "Log file not found: $LOG_FILE"
    fi
EOF

echo ""
echo "✅ [5/5] Deploy complete!"
echo ""
echo "📝 To monitor logs in real-time, run:"
echo "   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'tail -f /root/CSMS/logs/app-\$(date +%Y-%m-%d).log'"
echo ""
echo "🔍 To check for fora072 connector initialization:"
echo "   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'grep -E \"(fora|StatusNotification|Triggering)\" /root/CSMS/logs/app-\$(date +%Y-%m-%d).log | tail -30'"
