"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargingSession = exports.ConfigurationKey = exports.Firmware = exports.Diagnostics = exports.ChargingProfile = exports.Reservation = exports.Log = exports.LocalList = exports.Config = exports.ChargePoint = void 0;
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../logger");
const mongoURI = 'mongodb://localhost:27017/csms'; // Твоя БД "csms"
async function connectDB() {
    try {
        await mongoose_1.default.connect(mongoURI);
        logger_1.logger.info('[mongo] MongoDB connected!');
    }
    catch (err) {
        logger_1.logger.error(`[mongo] MongoDB error: ${err}`);
        process.exit(1);
    }
}
// ChargePoint
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
const chargingSessionSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, required: true },
    connectorId: { type: Number, required: true },
    transactionId: { type: String, required: true }, // Связь с Transaction
    limitType: { type: String, enum: ['percentage', 'amount', 'full'], required: true },
    limitValue: { type: Number, required: true }, // 80 для %, 10 для суммы, 100 для full
    tariffPerKWh: { type: Number, default: 0.1 }, // Тариф для расчёта суммы
    batteryCapacityKWh: { type: Number, default: 60 }, // Ёмкость батареи (из конфигурации)
    currentKWh: { type: Number, default: 0 }, // Текущий счётчик (обновляется в MeterValues)
    startTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'stopped', 'completed'], default: 'active' }
});
// Config
const configSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, ref: 'ChargePoint' },
    key: String,
    value: String,
    readonly: Boolean
});
// LocalList
const localListSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    listVersion: { type: Number, required: true },
    localList: [{
            idTag: { type: String, required: true },
            status: { type: String, enum: ['Accepted', 'Blocked'], required: true },
            expiryDate: Date
        }],
    updatedAt: { type: Date, default: Date.now }
});
// Log
const logSchema = new mongoose_1.default.Schema({
    action: { type: String, required: true }, // 'BootNotification', 'StartTransaction' и т.д.
    chargePointId: { type: String, required: true },
    payload: { type: Object }, // {vendor: 'Test', model: 'Model'} — весь req
    timestamp: { type: Date, default: Date.now }
});
// Reservation
const reservationSchema = new mongoose_1.default.Schema({
    id: { type: Number, required: true }, // Reservation ID
    chargePointId: { type: String, required: true },
    connectorId: { type: Number },
    idTag: { type: String },
    expiryDate: { type: Date },
    status: { type: String, default: 'Reserved' }
});
// ChargingProfile
const chargingProfileSchema = new mongoose_1.default.Schema({
    id: { type: Number, required: true },
    chargePointId: { type: String, required: true },
    stackLevel: { type: Number },
    chargingProfilePurpose: { type: String },
    chargingProfileKind: { type: String },
    chargingSchedule: { type: Object },
    status: { type: String, default: 'Accepted' }
});
// Diagnostics
const diagnosticsSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    requestId: { type: String },
    fileName: { type: String },
    status: { type: String, default: 'Idle' }
});
// Firmware
const firmwareSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    firmwareVersion: { type: String },
    status: { type: String, default: 'Downloaded' }
});
// ConfigurationKey
const configurationKeySchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String },
    readonly: { type: Boolean, default: false }
});
// Экспорт моделей (используем типизированные модели)
exports.ChargePoint = mongoose_1.default.model('ChargePoint', chargePointSchema);
exports.Config = mongoose_1.default.model('Config', configSchema);
exports.LocalList = mongoose_1.default.model('LocalList', localListSchema);
exports.Log = mongoose_1.default.model('Log', logSchema);
exports.Reservation = mongoose_1.default.model('Reservation', reservationSchema);
exports.ChargingProfile = mongoose_1.default.model('ChargingProfile', chargingProfileSchema);
exports.Diagnostics = mongoose_1.default.model('Diagnostics', diagnosticsSchema);
exports.Firmware = mongoose_1.default.model('Firmware', firmwareSchema);
exports.ConfigurationKey = mongoose_1.default.model('ConfigurationKey', configurationKeySchema);
exports.ChargingSession = mongoose_1.default.model('ChargingSession', chargingSessionSchema);
