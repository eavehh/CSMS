const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8081/ws');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket');

    // Send auth request
    const authMsg = {
        id: 'test-auth-001',
        action: 'auth',
        params: {
            apiKey: 'test-mobile-key-123'
        }
    };

    console.log('→ Sending auth:', JSON.stringify(authMsg));
    ws.send(JSON.stringify(authMsg));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('← Received:', JSON.stringify(msg, null, 2));

    if (msg.id === 'test-auth-001') {
        if (msg.result && msg.result.status === 'ok') {
            console.log('✅ Auth successful!');

            // Try getStations
            setTimeout(() => {
                const stationsMsg = {
                    id: 'test-stations-001',
                    action: 'getStations'
                };
                console.log('\n→ Sending getStations:', JSON.stringify(stationsMsg));
                ws.send(JSON.stringify(stationsMsg));
            }, 100);
        } else if (msg.error) {
            console.error('❌ Auth failed:', msg.error);
            ws.close();
        }
    } else if (msg.id === 'test-stations-001') {
        console.log('✅ Got stations response');
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
    console.log('🔌 Connection closed');
    process.exit(0);
});

// Timeout
setTimeout(() => {
    console.log('⏱️ Timeout - closing connection');
    ws.close();
}, 5000);
