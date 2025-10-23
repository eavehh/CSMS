#!/usr/bin/env node
/**
 * Перезагрузка станции fora072 для применения конфигурации MeterValues
 */

const http = require('http');

const SERVER = '176.88.248.139';
const PORT = 8081;
const STATION = 'fora072';

function sendResetCommand(type) {
    const data = JSON.stringify({
        chargePointId: STATION,
        action: 'Reset',
        payload: { type }
    });

    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: SERVER,
            port: PORT,
            path: '/api/remote-control',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (e) {
                    resolve({ success: false, error: 'Invalid response' });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🔄 Перезагрузка станции fora072 для применения конфигурации');
    console.log('===========================================================\n');

    console.log('📡 Отправляем команду Reset (Soft)...');
    try {
        const result = await sendResetCommand('Soft');
        if (result.success) {
            console.log('✅ Команда отправлена успешно!');
            console.log('⏳ Станция перезагружается...\n');

            console.log('📝 После перезагрузки:');
            console.log('   1. Подождите ~30 секунд');
            console.log('   2. Запустите зарядку на коннекторе 3');
            console.log('   3. Проверьте логи на сервере:');
            console.log('      ssh root@176.88.248.139');
            console.log('      tail -f /root/CSMS/logs/app-$(date +%Y-%m-%d).log | grep MeterValues');
            console.log('   4. Вы ДОЛЖНЫ увидеть [MeterValues] каждые 10 секунд! 🔋⚡\n');
        } else {
            console.log('❌ Ошибка:', result.error || result.message);
        }
    } catch (e) {
        console.log('❌ Ошибка:', e.message);
    }
}

main().catch(e => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
});
