"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = exports.ChargePoint = exports.Config = void 0;
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const mongoURI = 'mongodb://localhost:27017/csms'; // Твоя БД "csms"
async function connectDB() {
    try {
        await mongoose_1.default.connect(mongoURI);
        console.log('MongoDB connected!');
    }
    catch (err) {
        console.error('MongoDB error:', err);
        process.exit(1);
    }
}
// Схема ChargePoint (как тип из types/1.6/)
const chargePointSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true }, // chargeBoxIdentity
    vendor: { type: String, required: true }, // Из boot
    model: { type: String, required: true },
    serial: { type: String },
    firmware: { type: String },
    status: { type: String, default: 'Available' } // Из statusNotification
});
// Схема Transaction
const transactionSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, ref: 'ChargePoint' }, // Связь с ChargePoint
    startTime: { type: Date, required: true },
    stopTime: Date,
    energy: Number,
    cost: Number,
    idTag: String // Из authorize
});
const configSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, ref: 'ChargePoint' },
    key: String,
    value: String,
    readonly: Boolean
});
exports.Config = mongoose_1.default.model('Config', configSchema);
exports.ChargePoint = mongoose_1.default.model('ChargePoint', chargePointSchema);
exports.Transaction = mongoose_1.default.model('Transaction', transactionSchema);
