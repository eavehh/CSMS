"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateOCPPFunctionality = demonstrateOCPPFunctionality;
exports.setupRemoteCommandHandlers = setupRemoteCommandHandlers;
exports.multiConnectorExample = multiConnectorExample;
const wsClient_1 = require("./wsClient");
const messageSender_1 = require("./messageSender");
// Пример использования всех функций OCPP
async function demonstrateOCPPFunctionality() {
    try {
        const ws = await (0, wsClient_1.connectClient)('CP_001'); //boot
        console.log('< Демонстрация OCPP функциональности >\n');
        // Ждем немного для установки соединения
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 1. Авторизация пользователя
        console.log('1. Авторизация пользователя...');
        (0, messageSender_1.sendAuthorize)(ws, { idTag: 'USER_123' }, wsClient_1.manager);
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 2. Изменение статуса на Preparing (подключение кабеля)
        console.log('2. Подключение кабеля...');
        (0, messageSender_1.sendStatusNotification)(ws, {
            connectorId: 1,
            status: 'Preparing',
            errorCode: 'NoError'
        }, wsClient_1.manager);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 3. Начало транзакции
        console.log('3. Начало транзакции...');
        (0, messageSender_1.sendStartTransaction)(ws, {
            connectorId: 1,
            idTag: 'USER_123',
            meterStart: 0,
            timestamp: new Date().toISOString()
        }, wsClient_1.manager);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 4. Отправка метрик во время зарядки (каждые 5 секунд)
        console.log('4. Отправка метрик зарядки...');
        let meterValue = 1000; // Начальное значение в Вт⋅ч
        const meterInterval = setInterval(() => {
            meterValue += 500; // Увеличиваем на 500 Вт⋅ч каждые 5 секунд
            (0, messageSender_1.sendMeterValues)(ws, {
                connectorId: 1,
                transactionId: wsClient_1.manager.getState().getConnectorId() || 1,
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
            }, wsClient_1.manager);
            console.log(`   Отправлены метры: ${meterValue} Wh`);
        }, 5000);
        // 5. Через 4 раза останавливаем зарядку
        setTimeout(async () => {
            console.log('5. Остановка транзакции...');
            clearInterval(meterInterval);
            const currentTransaction = wsClient_1.manager.getState().getCurrentTransaction();
            if (currentTransaction) {
                (0, messageSender_1.sendStopTransaction)(ws, {
                    transactionId: currentTransaction,
                    meterStop: meterValue,
                    timestamp: new Date().toISOString(),
                    idTag: 'USER_123',
                    reason: 'Local'
                }, wsClient_1.manager);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            // 6. Изменение конфигурации
            console.log('6. Изменение конфигурации...');
            (0, messageSender_1.sendChangeConfiguration)(ws, {
                key: 'HeartbeatInterval',
                value: '120'
            }, wsClient_1.manager);
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 7. Получение конфигурации
            console.log('7. Получение конфигурации...');
            (0, messageSender_1.sendGetConfiguration)(ws, {
                key: ['HeartbeatInterval', 'ConnectionTimeout']
            }, wsClient_1.manager);
            console.log('\n< Демонстрация завершена >');
            console.log('Транзакция завершена, станция возвращается в состояние Available');
        }, 120000); // 2 минуты
    }
    catch (error) {
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
    const ws = await (0, wsClient_1.connectClient)('CP_MULTI_001');
    // Добавляем второй коннектор
    wsClient_1.manager.addConnector(2);
    console.log('Добавлен второй коннектор');
    console.log(`Доступные коннекторы: ${wsClient_1.manager.getAllConnectors().map(c => c.getConnectorId()).join(', ')}`);
    // Демонстрация независимой работы коннекторов
    // Коннектор 1 начинает транзакцию
    (0, messageSender_1.sendStartTransaction)(ws, {
        connectorId: 1,
        idTag: 'USER_001',
        meterStart: 0,
        timestamp: new Date().toISOString()
    }, wsClient_1.manager);
    // Коннектор 2 также может начать транзакцию
    setTimeout(() => {
        (0, messageSender_1.sendStartTransaction)(ws, {
            connectorId: 2,
            idTag: 'USER_002',
            meterStart: 0,
            timestamp: new Date().toISOString()
        }, wsClient_1.manager);
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
