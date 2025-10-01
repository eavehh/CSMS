import mongoose from 'mongoose';


const mongoURI = 'mongodb://localhost:27017/csms';  // Твоя БД "csms"

export async function connectDB() {
    try {
        await mongoose.connect(mongoURI);
        console.log('MongoDB connected!');
    } catch (err) {
        console.error('MongoDB error:', err);
        process.exit(1);
    }
}

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

const transactionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    chargePointId: { type: String, ref: 'ChargePoint' },  // Связь с ChargePoint
    startTime: { type: Date, required: true },
    stopTime: Date,
    energy: Number,
    cost: Number,
    idTag: String  // Из authorize
});

const configSchema = new mongoose.Schema({
    chargePointId: { type: String, ref: 'ChargePoint' },
    key: String,
    value: String,
    readonly: Boolean
});

const localListSchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    listVersion: { type: Number, required: true },
    localList: [{
        idTag: { type: String, required: true },
        status: { type: String, enum: ['Accepted', 'Blocked'], required: true },
        expiryDate: Date
    }],
    updatedAt: { type: Date, default: Date.now }  // Когда обновили
});

export const LocalList = mongoose.model('LocalList', localListSchema);
export const Config = mongoose.model('Config', configSchema);
export const ChargePoint = mongoose.model('ChargePoint', chargePointSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);



// Reservation (5.1, 5.13)
const reservationSchema = new mongoose.Schema({
    id: { type: Number, required: true },  // Reservation ID
    chargePointId: { type: String, required: true },
    connectorId: { type: Number },
    idTag: { type: String },
    expiryDate: { type: Date },
    status: { type: String, default: 'Reserved' }  // Reserved, Occupied, etc.
});
export const Reservation = mongoose.model('Reservation', reservationSchema);

// ChargingProfile (5.5, 5.16)
const chargingProfileSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    chargePointId: { type: String, required: true },
    stackLevel: { type: Number },
    chargingProfilePurpose: { type: String },  // TxDefault, TxProfile
    chargingProfileKind: { type: String },  // Absolute, Relative
    chargingSchedule: { type: Object },  // SchedulePeriod[]
    status: { type: String, default: 'Accepted' }
});
export const ChargingProfile = mongoose.model('ChargingProfile', chargingProfileSchema);

// Diagnostics (5.9)
const diagnosticsSchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    requestId: { type: String },
    fileName: { type: String },
    status: { type: String, default: 'Idle' }  // Idle, Uploading, UploadFailed
});
export const Diagnostics = mongoose.model('Diagnostics', diagnosticsSchema);

// Firmware (5.19)
const firmwareSchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    firmwareVersion: { type: String },
    status: { type: String, default: 'Downloaded' }  // Downloaded, Installing, etc.
});
export const Firmware = mongoose.model('Firmware', firmwareSchema);

// ConfigurationKey (5.3, 5.8)
const configurationKeySchema = new mongoose.Schema({
    chargePointId: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String },
    readonly: { type: Boolean, default: false }
});
export const ConfigurationKey = mongoose.model('ConfigurationKey', configurationKeySchema);
