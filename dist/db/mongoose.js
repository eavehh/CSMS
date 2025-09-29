"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = exports.ChargePoint = exports.Config = exports.LocalList = void 0;
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
const chargePointSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true }, // chargeBoxIdentity
    vendor: { type: String, required: true }, // Из boot
    model: { type: String, required: true },
    serial: { type: String },
    firmware: { type: String },
    status: { type: String, default: 'Available' }, // Из statusNotification
    lastOffline: { type: Date },
    lastBoot: { type: Date },
    iccid: { type: String }, // Boot
    imsi: { type: String }, // Boot
    meterType: { type: String }, // Boot
    meterSerialNumber: { type: String }, // Boot
});
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
const localListSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    listVersion: { type: Number, required: true },
    localList: [{
            idTag: { type: String, required: true },
            status: { type: String, enum: ['Accepted', 'Blocked'], required: true },
            expiryDate: Date
        }],
    updatedAt: { type: Date, default: Date.now } // Когда обновили
});
exports.LocalList = mongoose_1.default.model('LocalList', localListSchema);
exports.Config = mongoose_1.default.model('Config', configSchema);
exports.ChargePoint = mongoose_1.default.model('ChargePoint', chargePointSchema);
exports.Transaction = mongoose_1.default.model('Transaction', transactionSchema);
