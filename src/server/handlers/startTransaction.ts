import { StartTransactionRequest } from '../types/1.6/StartTransaction';
import { StartTransactionResponse } from '../types/1.6/StartTransactionResponse';
import { Transaction } from '../../db/entities/Transaction';
import { AppDataSource } from '../../db/postgres'
import { Log } from '../../db/mongoose';
import { ChargingSession } from '../../db/mongoose';
import { logger } from '../../logger';
import WebSocket from 'ws';
import { connectionManager } from '../../server/index';
import { resolve } from 'path';

export async function handleStartTransaction(req: StartTransactionRequest & {  // Расширение типа
    limitType?: 'percentage' | 'amount' | 'full';
    limitValue?: number;
    tariffPerKWh?: number;
}, chargePointId: string, ws: WebSocket): Promise<StartTransactionResponse> {


        const transId = Date.now().toString();  // Генерация строкового ID

    try {
        // postgres
        const idTagStatus = 'Accepted';  // Замените на реальную проверку
        const repo = AppDataSource.getRepository(Transaction);
        
        const newTx = repo.create({
            id: transId,
            chargePointId,
            connectorId: req.connectorId,
            startTime: new Date(req.timestamp),
            idTag: req.idTag,
            meterStart: req.meterStart,
        });
        await repo.save(newTx)
        // postgres


        await Log.create({ action: 'StartTransaction', chargePointId, payload: req });

        const limitType = req.limitType || 'full';  // 'percentage', 'amount', 'full'
        const limitValue = req.limitValue || 100;  // Из запроса
        const tariffPerKWh = req.tariffPerKWh || 0.1;
        const batteryCapacityKWh = 60;  // Из конфигурации ChargePoint

        const session = new ChargingSession({
            id: `session-${transId}`,
            chargePointId,
            connectorId: req.connectorId,
            transactionId: transId.toString(),
            limitType,
            limitValue,
            tariffPerKWh,
            batteryCapacityKWh,
            startTime: new Date(req.timestamp),
            status: 'active'
        });
        await session.save();


        // Формируем ответ (transactionId как number)
        const response: StartTransactionResponse = {
            transactionId: transId,  // Теперь соответствует типу number
            idTagInfo: {
                status: idTagStatus  // 'Accepted' или 'Blocked'
            }
        };

        logger.info(`[StartTransaction] Started session with limits: type=${limitType}, value=${limitValue}, tariff=${tariffPerKWh}`);
        logger.info(`[StartTransaction] Start tx from ${chargePointId}: id ${transId}, connector ${req.connectorId}`);

        // Обновляем состояние коннектора
        connectionManager.updateConnectorState(chargePointId, req.connectorId, 'Charging', transId.toString());

        return response;
    } catch (err) {
        logger.error(`Error in StartTransaction: ${err}`);
        const errorResponse: StartTransactionResponse = {
            idTagInfo: { status: 'Invalid' },
            transactionId: transId  // Числовой ID даже при ошибке
        };
        return errorResponse;
    }
}