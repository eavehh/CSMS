"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const Transaction_1 = require("./entities/Transaction");
const MeterValue_1 = require("./entities/MeterValue");
// Lazy initialization - only create if explicitly initialized
let _appDataSource = null;
exports.AppDataSource = {
    get isInitialized() {
        return _appDataSource?.isInitialized || false;
    },
    async initialize() {
        if (!_appDataSource) {
            _appDataSource = new typeorm_1.DataSource({
                type: 'postgres',
                host: 'localhost',
                port: 5432,
                username: 'db_user',
                password: 'db_password',
                database: 'csms',
                synchronize: true,
                logging: false,
                entities: [Transaction_1.Transaction, MeterValue_1.MeterValue],
            });
        }
        return _appDataSource.initialize();
    },
    getRepository(entity) {
        if (!_appDataSource || !_appDataSource.isInitialized) {
            throw new Error('AppDataSource not initialized');
        }
        return _appDataSource.getRepository(entity);
    }
};
