// Скрипт для создания API ключа для мобильного приложения
const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    owner: { type: String },
    active: { type: Boolean, default: true },
    scopes: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

async function createApiKey() {
    try {
        await mongoose.connect('mongodb://localhost:27017/csms');
        console.log('[MongoDB] Connected');

        const key = 'mobile-app-key-' + Date.now();

        const apiKey = new ApiKey({
            key: key,
            owner: 'Mobile App',
            active: true,
            scopes: ['basic'],
            createdAt: new Date()
        });

        await apiKey.save();
        console.log('[SUCCESS] API Key created:');
        console.log('---');
        console.log('Key:', key);
        console.log('Owner: Mobile App');
        console.log('Scopes: basic');
        console.log('---');
        console.log('Use this key in your mobile app for authentication');

        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
}

createApiKey();
