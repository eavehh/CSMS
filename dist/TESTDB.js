"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_2 = require("./db/mongoose");
const mongoose_3 = require("./db/mongoose");
async function insertTestData() {
    await (0, mongoose_2.connectDB)();
    const testTx = new mongoose_3.Transaction({
        id: 'test-tx-1',
        chargePointId: 'CP_001',
        connectorId: 1,
        startTime: new Date('2025-10-05T10:00:00Z'),
        stopTime: new Date('2025-10-05T11:00:00Z'),
        meterStart: 0,
        meterStop: 5000000, // 5000 Wh = 5 kWh
        idTag: 'USER_123',
        reason: 'Local'
    });
    await testTx.save();
    console.log('Test transaction inserted');
    mongoose_1.default.disconnect();
}
insertTestData().catch(console.error);
