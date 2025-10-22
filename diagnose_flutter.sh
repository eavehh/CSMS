#!/bin/bash
# Скрипт для диагностики Flutter подключения

echo "🔍 Диагностика подключения Flutter → CSMS Server"
echo "================================================"
echo ""

echo "1️⃣ HTTP API тест:"
echo "---"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://176.88.248.139:8081/api/stations)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
echo "Статус код: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP API работает"
    echo "$RESPONSE" | head -5 | grep -v "HTTP_CODE:"
else
    echo "❌ HTTP API не работает"
fi
echo ""

echo "2️⃣ WebSocket тест (через wscat, если установлен):"
echo "---"
if command -v wscat &> /dev/null; then
    timeout 3 wscat -c ws://176.88.248.139:8081/mobile-client -x '{"id":"test","method":"GET","url":"/api/stations"}' 2>&1 || echo "WebSocket тест завершён"
else
    echo "⚠️  wscat не установлен. Установите: npm install -g wscat"
fi
echo ""

echo "3️⃣ Порт 8081 доступен:"
echo "---"
nc -zv 176.88.248.139 8081 2>&1
echo ""

echo "4️⃣ DNS резолюция:"
echo "---"
nslookup 176.88.248.139 2>&1 | grep -A2 "Name:"
echo ""

echo "📱 Проверьте в Flutter приложении:"
echo "=================================="
echo ""
echo "1. Config.dart - правильный ли URL?"
echo "   Должно быть: ws://176.88.248.139:8081/mobile-client"
echo ""
echo "2. Логи Flutter при подключении:"
echo "   flutter run --verbose"
echo "   Ищите: 'CSMSAPI: connecting to' и ошибки WebSocket"
echo ""
echo "3. Разрешения в AndroidManifest.xml / Info.plist:"
echo "   Android: <uses-permission android:name=\"android.permission.INTERNET\"/>"
echo "   iOS: Allow Arbitrary Loads в Info.plist"
echo ""
echo "4. Эмулятор vs Реальное устройство:"
echo "   Эмулятор: может нужен 'ws://10.0.2.2:8081' (Android)"
echo "   Реальное устройство: должен быть в той же сети или использовать внешний IP"
echo ""
echo "5. HTTP вместо HTTPS:"
echo "   Flutter может блокировать незащищённые HTTP/WS подключения"
echo "   Добавьте в AndroidManifest.xml: android:usesCleartextTraffic=\"true\""
echo ""

echo "🔧 Быстрый тест из Flutter:"
echo "=========================="
echo ""
echo "Добавьте в main.dart перед runApp():"
echo ""
cat << 'DART'
import 'package:http/http.dart' as http;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Тест HTTP
  try {
    final response = await http.get(
      Uri.parse('http://176.88.248.139:8081/api/stations')
    ).timeout(Duration(seconds: 5));
    print('✅ HTTP works: ${response.statusCode}');
  } catch (e) {
    print('❌ HTTP failed: $e');
  }
  
  // Тест WebSocket
  try {
    final channel = WebSocketChannel.connect(
      Uri.parse('ws://176.88.248.139:8081/mobile-client')
    );
    await channel.ready.timeout(Duration(seconds: 5));
    print('✅ WebSocket connected');
    channel.sink.close();
  } catch (e) {
    print('❌ WebSocket failed: $e');
  }
  
  runApp(MyApp());
}
DART
echo ""
echo "Запустите и смотрите консоль Flutter!"
