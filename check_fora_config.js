#!/usr/bin/env node

/**
 * 🔍 Диагностика конфигурации fora072
 * Проверяет текущие настройки станции
 */

const axios = require('axios');

const SERVER_URL = 'http://176.88.248.139:8081';
const STATION_ID = 'fora072';

// Задержка между запросами
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendRemoteCommand(action, params = {}) {
    try {
        const response = await axios.post(`${SERVER_URL}/api/remote-control`, {
            chargePointId: STATION_ID,
            action,
            ...params
        });
        return response.data;
    } catch (error) {
        console.error(`❌ Ошибка при отправке ${action}:`, error.response?.data || error.message);
        return null;
    }
}

async function main() {
    console.log('🔍 Диагностика конфигурации fora072\n');

    // Ключи конфигурации для проверки
    const configKeys = [
        'MeterValueSampleInterval',
        'MeterValuesSampledData',
        'MeterValuesAlignedData',
        'ClockAlignedDataInterval',
        'StopTxnSampledData',
        'StopTxnAlignedData',
        'SampledDataTxUpdatedInterval',
        'SampledDataTxStartedMeasurands',
        'SampledDataTxUpdatedMeasurands',
        'SampledDataTxEndedMeasurands'
    ];

    console.log('📋 Запрашиваем текущие значения конфигурации...\n');

    for (const key of configKeys) {
        console.log(`\n🔑 Проверяем ключ: ${key}`);
        const result = await sendRemoteCommand('GetConfiguration', { key });

        if (result) {
            console.log(`   Результат: ✅`, JSON.stringify(result, null, 2));
        } else {
            console.log(`   Результат: ❌ Ошибка запроса`);
        }

        await delay(2000); // 2 секунды между запросами
    }

    console.log('\n\n📊 Также запрашиваем ВСЮ конфигурацию станции...\n');
    const allConfig = await sendRemoteCommand('GetConfiguration', {});

    if (allConfig) {
        console.log('✅ Полная конфигурация получена');
        console.log(JSON.stringify(allConfig, null, 2));
    }

    console.log('\n\n✅ Диагностика завершена!');
    console.log('\n💡 Следующие шаги:');
    console.log('   1. Проверьте значения MeterValueSampleInterval');
    console.log('   2. Проверьте значения MeterValuesSampledData');
    console.log('   3. Убедитесь что параметры не readonly');
    console.log('   4. Если параметры readonly - проблема в прошивке станции');
}

main().catch(console.error);
