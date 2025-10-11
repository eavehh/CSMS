import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../logger';

const mongoURI = 'mongodb://localhost:27017/csms';  // Твоя БД "csms"

export async function connectDB() {
    try {
        await mongoose.connect(mongoURI);
        logger.info('[mongo] MongoDB connected!');
    } catch (err) {
        logger.error(`[mongo] MongoDB error: ${err}`);
        process.exit(1);
    }
}

// ChargePoint
const chargePointSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },  // chargeBoxIdentity
    vendor: { type: String, required: true },           // Из boot
    model: { type: String, required: true },
    serial: { type: String },
    firmware: { type: String },
    status: { type: String, default: 'Available' },      // Из statusNotification
    lastOffline: { type: Date },
    lastBoot: { type: Date },
    iccid: { type: String }, // Boot
    imsi: { type: String }, // Boot
    meterType: { type: String }, // Boot
    meterSerialNumber: { type: String }, // Boot
});

// Transaction (синхронизировано с интерфейсом)
export interface ITransaction extends Document {
    id: string;  // UUID or string ID
    chargePointId: string;
    connectorId: number;  // ID коннектора (number по протоколу OCPP)
    startTime: Date;
    stopTime?: Date;
    meterStart?: number;
    meterStop?: number;
    energy?: number;  // Общая энергия (Wh)
    totalKWh?: number;  // Сохраняем вычисленное
    efficiencyPercentage?: number;
    tariffPerKWh?: number;
    cost?: number;    // Стоимость (опционально)
    idTag?: string;
    reason?: string;  // Причина остановки (опционально)
    transactionData?: any[];  // Массив MeterValue (опционально)
}

const TransactionSchema = new mongoose.Schema<ITransaction>({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, required: true, index: true },  // Индекс для поиска
    connectorId: { type: Number, required: true },  // ID коннектора
    startTime: { type: Date, required: true, index: true },  // Индекс по времени
    stopTime: { type: Date },
    meterStart: { type: Number, default: 0 },
    meterStop: { type: Number },
    totalKWh: { type: Number, default: 0 },  // Сохраняем вычисленное
    cost: { type: Number, default: 0 },  // Сохраняем сумму
    efficiencyPercentage: { type: Number, default: 0 },  // Сохраняем процент
    tariffPerKWh: { type: Number, default: 0.1 }  // Тариф на момент транзакции
});

const chargingSessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, required: true },
    connectorId: { type: Number, required: true },
    transactionId: { type: String, required: true },  // Связь с Transaction
    limitType: { type: String, enum: ['percentage', 'amount', 'full'], required: true },
    limitValue: { type: Number, required: true },  // 80 для %, 10 для суммы, 100 для full
    tariffPerKWh: { type: Number, default: 0.1 },  // Тариф для расчёта суммы
    batteryCapacityKWh: { type: Number, default: 60 },  // Ёмкость батареи (из конфигурации)
    currentKWh: { type: Number, default: 0 },  // Текущий счётчик (обновляется в MeterValues)
    startTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'stopped', 'completed'], default: 'active' }
});

// Config
const configSchema = new mongoose.Schema({
    chargePointId: { type: String, ref: 'ChargePoint' },
    key: String,
    value: String,
    readonly: Boolean
});

// LocalList
const localListSchema = new mongoose.Schema({
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
const logSchema = new mongoose.Schema({
    action: { type: String, required: true },  // 'BootNotification', 'StartTransaction' и т.д.
    chargePointId: { type: String, required: true },
    payload: { type: Object },  // {vendor: 'Test', model: 'Model'} — весь req
    timestamp: { type: Date, default: Date.now }
});

// Reservation
const reservationSchema = new mongoose.Schema({
    id: { type: Number, required: true },  // Reservation ID
    chargePointId: { type: String, required: true },
    connectorId: { type: Number },
    idTag: { type: String },
    expiryDate: { type: Date },
    status: { type: String, default: 'Reserved' }
});

// ChargingProfile
const chargingProfileSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    chargePointId: { type: String, required: true },
    stackLevel: { type: Number },
    chargingProfilePurpose: { type: String },
    chargingProfileKind: { type: String },
    chargingSchedule: { type: Object },
    status: { type: String, default: 'Accepted' }
});

// Diagnostics
const diagnosticsSchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    requestId: { type: String },
    fileName: { type: String },
    status: { type: String, default: 'Idle' }
});

// Firmware
const firmwareSchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    firmwareVersion: { type: String },
    status: { type: String, default: 'Downloaded' }
});

// ConfigurationKey
const configurationKeySchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String },
    readonly: { type: Boolean, default: false }
});


// Экспорт моделей (используем типизированные модели)
export const ChargePoint = mongoose.model('ChargePoint', chargePointSchema);
export const Transaction: Model<ITransaction> = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export const Config = mongoose.model('Config', configSchema);
export const LocalList = mongoose.model('LocalList', localListSchema);
export const Log = mongoose.model('Log', logSchema);
export const Reservation = mongoose.model('Reservation', reservationSchema);
export const ChargingProfile = mongoose.model('ChargingProfile', chargingProfileSchema);
export const Diagnostics = mongoose.model('Diagnostics', diagnosticsSchema);
export const Firmware = mongoose.model('Firmware', firmwareSchema);
export const ConfigurationKey = mongoose.model('ConfigurationKey', configurationKeySchema);
export const ChargingSession = mongoose.model('ChargingSession', chargingSessionSchema);
