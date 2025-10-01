import WebSocket from 'ws';
import { connectClient, manager } from './wsClient';
import {
    sendAuthorize,
    sendStartTransaction,
    sendStopTransaction,
    sendStatusNotification,
    sendMeterValues,
    sendChangeConfiguration,
    sendGetConfiguration
} from './messageSender';

// Пример использования всех функций OCPP
async function demonstrateOCPPFunctionality() {
    try {
        const ws = await connectClient('CP_001'); //boot
        
        console.log('< Демонстрация OCPP функциональности >\n');
        
        // Ждем немного для установки соединения
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 1. Авторизация пользователя
        console.log('1. Авторизация пользователя...');
        sendAuthorize(ws, { idTag: 'USER_123' }, manager);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. Изменение статуса на Preparing (подключение кабеля)
        console.log('2. Подключение кабеля...');
        sendStatusNotification(ws, {
            connectorId: 1,
            status: 'Preparing',
            errorCode: 'NoError'
        }, manager);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Начало транзакции
        console.log('3. Начало транзакции...');
        sendStartTransaction(ws, {
            connectorId: 1,
            idTag: 'USER_123',
            meterStart: 0,
            timestamp: new Date().toISOString()
        }, manager);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. Отправка метрик во время зарядки (каждые 5 секунд)
        console.log('4. Отправка метрик зарядки...');
        let meterValue = 1000; // Начальное значение в Вт⋅ч
        
        const meterInterval = setInterval(() => {
            meterValue += 500; // Увеличиваем на 500 Вт⋅ч каждые 5 секунд
            
            sendMeterValues(ws, {
                connectorId: 1,
                transactionId: manager.getState().getConnectorId() || 1,
                meterValue: [{
                    timestamp: new Date().toISOString(),
                    sampledValue: [{
                        value: meterValue.toString(),
                        measurand: 'Energy.Active.Import.Register',
                        unit: 'Wh'
                    }, {
                        value: '32.5',
                        measurand: 'Power.Active.Import',
                        unit: 'W'
                    }, {
                        value: '230',
                        measurand: 'Voltage',
                        phase: 'L1-N',
                        unit: 'V'
                    }]
                }]
            }, manager);
            
            console.log(`   Отправлены метры: ${meterValue} Wh`);
        }, 5000);
        
        // 5. Через 4 раза останавливаем зарядку
        setTimeout(async () => {
            console.log('5. Остановка транзакции...');
            clearInterval(meterInterval);
            
            const currentTransaction = manager.getState().getCurrentTransaction();
            if (currentTransaction) {
                sendStopTransaction(ws, {
                    transactionId: currentTransaction,
                    meterStop: meterValue,
                    timestamp: new Date().toISOString(),
                    idTag: 'USER_123',
                    reason: 'Local'
                }, manager);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 6. Изменение конфигурации
            console.log('6. Изменение конфигурации...');
            sendChangeConfiguration(ws, {
                key: 'HeartbeatInterval',
                value: '120'
            }, manager);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 7. Получение конфигурации
            console.log('7. Получение конфигурации...');
            sendGetConfiguration(ws, {
                key: ['HeartbeatInterval', 'ConnectionTimeout']
            }, manager);
            
            console.log('\n< Демонстрация завершена >');
            console.log('Транзакция завершена, станция возвращается в состояние Available');
            
        }, 120000); // 2 минуты
        
    } catch (error) {
        console.error('Ошибка в демонстрации:', error);
    }
}

// Пример обработки удаленных команд от сервера
function setupRemoteCommandHandlers() {
    console.log('< Настройка обработчиков удаленных команд >\n');
    console.log('< !!!!! пока не добавил пример >\n');
    
    // Можно добавить обработчики для:
    // - RemoteStartTransaction
    // - RemoteStopTransaction
    // - ChangeConfiguration
    // - Reset
    // - UnlockConnector
}

// Пример работы с несколькими коннекторами
async function multiConnectorExample() {
    console.log('< Пример с несколькими коннекторами >\n');
    
    const ws = await connectClient('CP_MULTI_001');
    
    // Добавляем второй коннектор
    manager.addConnector(2);
    
    console.log('Добавлен второй коннектор');
    console.log(`Доступные коннекторы: ${manager.getAllConnectors().map(c => c.getConnectorId()).join(', ')}`);
    
    // Демонстрация независимой работы коннекторов
    // Коннектор 1 начинает транзакцию
    sendStartTransaction(ws, {
        connectorId: 1,
        idTag: 'USER_001',
        meterStart: 0,
        timestamp: new Date().toISOString()
    }, manager);
    
    // Коннектор 2 также может начать транзакцию
    setTimeout(() => {
        sendStartTransaction(ws, {
            connectorId: 2,
            idTag: 'USER_002',
            meterStart: 0,
            timestamp: new Date().toISOString()
        }, manager);
    }, 5000);
}

// Запуск демонстрации
if (require.main === module) {
    console.log('CSMS OCPP Demo Client');
    console.log('=====================\n');
    
    // Можно выбрать режим работы через аргументы командной строки
    const mode = process.argv[2] || 'single';
    
    switch (mode) {
        case 'multi':
            multiConnectorExample();
            break;
        case 'demo':
        default:
            demonstrateOCPPFunctionality();
            break;
    }
}

export { demonstrateOCPPFunctionality, setupRemoteCommandHandlers, multiConnectorExample };