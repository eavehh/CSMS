"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationKey = exports.Firmware = exports.Diagnostics = exports.ChargingProfile = exports.Reservation = exports.Log = exports.Transaction = exports.ChargePoint = exports.Config = exports.LocalList = void 0;
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
const logSchema = new mongoose_1.default.Schema({
    action: { type: String, required: true }, // 'BootNotification', 'StartTransaction' и т.д.
    chargePointId: { type: String, required: true }, // 'CP_001'
    payload: { type: Object }, // {vendor: 'Test', model: 'Model'} — весь req
    timestamp: { type: Date, default: Date.now } // Авто-время
});
exports.Log = mongoose_1.default.model('Log', logSchema);
// Reservation (5.1, 5.13)
const reservationSchema = new mongoose_1.default.Schema({
    id: { type: Number, required: true }, // Reservation ID
    chargePointId: { type: String, required: true },
    connectorId: { type: Number },
    idTag: { type: String },
    expiryDate: { type: Date },
    status: { type: String, default: 'Reserved' } // Reserved, Occupied, etc.
});
exports.Reservation = mongoose_1.default.model('Reservation', reservationSchema);
// ChargingProfile (5.5, 5.16)
const chargingProfileSchema = new mongoose_1.default.Schema({
    id: { type: Number, required: true },
    chargePointId: { type: String, required: true },
    stackLevel: { type: Number },
    chargingProfilePurpose: { type: String }, // TxDefault, TxProfile
    chargingProfileKind: { type: String }, // Absolute, Relative
    chargingSchedule: { type: Object }, // SchedulePeriod[]
    status: { type: String, default: 'Accepted' }
});
exports.ChargingProfile = mongoose_1.default.model('ChargingProfile', chargingProfileSchema);
// Diagnostics (5.9)
const diagnosticsSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    requestId: { type: String },
    fileName: { type: String },
    status: { type: String, default: 'Idle' } // Idle, Uploading, UploadFailed
});
exports.Diagnostics = mongoose_1.default.model('Diagnostics', diagnosticsSchema);
// Firmware (5.19)
const firmwareSchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    firmwareVersion: { type: String },
    status: { type: String, default: 'Downloaded' } // Downloaded, Installing, etc.
});
exports.Firmware = mongoose_1.default.model('Firmware', firmwareSchema);
// ConfigurationKey (5.3, 5.8)
const configurationKeySchema = new mongoose_1.default.Schema({
    chargePointId: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String },
    readonly: { type: Boolean, default: false }
});
exports.ConfigurationKey = mongoose_1.default.model('ConfigurationKey', configurationKeySchema);
