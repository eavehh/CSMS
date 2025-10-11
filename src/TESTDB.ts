import mongoose from 'mongoose';
import { connectDB } from './db/mongoose';
import { Transaction } from './db/mongoose';

async function insertTestData() {
    await connectDB();
    const testTx = new Transaction({
        id: 'test-tx-1',
        chargePointId: 'CP_001',
        connectorId: 1,
        startTime: new Date('2025-10-05T10:00:00Z'),
        stopTime: new Date('2025-10-05T11:00:00Z'),
        meterStart: 0,
        meterStop: 5000000,  // 5000 Wh = 5 kWh
        idTag: 'USER_123',
        reason: 'Local'
    });
    await testTx.save();
    console.log('Test transaction inserted');
    mongoose.disconnect();
}

insertTestData().catch(console.error);