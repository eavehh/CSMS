#!/usr/bin/env node
/**
 * Настройка MeterValues для станции fora072
 * Решает проблему отсутствия MeterValues во время зарядки
 */

const http = require('http');

const SERVER = '176.88.248.139';
const PORT = 8081;
const STATION = 'fora072';

function sendRemoteCommand(key, value) {
    const data = JSON.stringify({
        chargePointId: STATION,
        action: 'ChangeConfiguration',
        payload: { key, value }
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
    console.log('🔧 Настройка MeterValues для станции fora072');
    console.log('==============================================\n');

    // 1. Интервал отправки MeterValues
    console.log('1️⃣ Устанавливаем интервал отправки MeterValues = 10 секунд');
    try {
        const result = await sendRemoteCommand('MeterValueSampleInterval', '10');
        console.log('   Результат:', result.success ? '✅ Успешно' : '❌ Ошибка', result.message || '');
    } catch (e) {
        console.log('   ❌ Ошибка:', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Какие данные отправлять
    console.log('\n2️⃣ Настраиваем какие данные отправлять');
    try {
        const result = await sendRemoteCommand(
            'MeterValuesSampledData',
            'Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage'
        );
        console.log('   Результат:', result.success ? '✅ Успешно' : '❌ Ошибка', result.message || '');
    } catch (e) {
        console.log('   ❌ Ошибка:', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Включить отправку на clock-aligned
    console.log('\n3️⃣ Включаем clock-aligned MeterValues (каждую минуту)');
    try {
        const result = await sendRemoteCommand('ClockAlignedDataInterval', '60');
        console.log('   Результат:', result.success ? '✅ Успешно' : '❌ Ошибка', result.message || '');
    } catch (e) {
        console.log('   ❌ Ошибка:', e.message);
    }

    console.log('\n✅ Настройка завершена!');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Запустите зарядку на коннекторе 3');
    console.log('   2. Проверьте логи сервера:');
    console.log('      ssh root@176.88.248.139');
    console.log('      tail -f /root/CSMS/logs/app-$(date +%Y-%m-%d).log | grep -E "(MeterValues|fora)"');
    console.log('   3. Вы должны увидеть [MeterValues] сообщения каждые 10 секунд\n');
}

main().catch(e => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
});
