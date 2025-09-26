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

// Схема ChargePoint (как тип из types/1.6/)
const chargePointSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },  // chargeBoxIdentity
    vendor: { type: String, required: true },           // Из boot
    model: { type: String, required: true },
    serial: { type: String },
    firmware: { type: String },
    status: { type: String, default: 'Available' }      // Из statusNotification
});

// Схема Transaction
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


export const Config = mongoose.model('Config', configSchema);
export const ChargePoint = mongoose.model('ChargePoint', chargePointSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);