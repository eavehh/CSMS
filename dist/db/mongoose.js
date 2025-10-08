"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationKey = exports.Firmware = exports.Diagnostics = exports.ChargingProfile = exports.Reservation = exports.Log = exports.LocalList = exports.Config = exports.Transaction = exports.ChargePoint = void 0;
exports.connectDB = connectDB;
const mongoose_1 = __importStar(require("mongoose"));
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
const TransactionSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, required: true, index: true }, // Индекс для поиска
    connectorId: { type: Number, required: true }, // ID коннектора
    startTime: { type: Date, required: true, index: true }, // Индекс по времени
    stopTime: { type: Date },
    meterStart: { type: Number },
    meterStop: { type: Number },
    energy: { type: Number },
    cost: { type: Number },
    idTag: { type: String },
    reason: { type: String, enum: ['Local', 'Remote', 'EVDisconnected', 'HardReset', 'PowerLoss', 'Reboot'] }, // Enum из OCPP
    transactionData: [{ type: mongoose_1.Schema.Types.Mixed }] // Гибкий тип для MeterValue
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
exports.Transaction = mongoose_1.default.model('Transaction', TransactionSchema);
exports.Config = mongoose_1.default.model('Config', configSchema);
exports.LocalList = mongoose_1.default.model('LocalList', localListSchema);
exports.Log = mongoose_1.default.model('Log', logSchema);
exports.Reservation = mongoose_1.default.model('Reservation', reservationSchema);
exports.ChargingProfile = mongoose_1.default.model('ChargingProfile', chargingProfileSchema);
exports.Diagnostics = mongoose_1.default.model('Diagnostics', diagnosticsSchema);
exports.Firmware = mongoose_1.default.model('Firmware', firmwareSchema);
exports.ConfigurationKey = mongoose_1.default.model('ConfigurationKey', configurationKeySchema);
