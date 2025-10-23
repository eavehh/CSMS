import { DataSource } from 'typeorm'
import { Transaction } from './entities/Transaction';
import { MeterValue } from './entities/MeterValue';

// Lazy initialization - only create if explicitly initialized
let _appDataSource: DataSource | null = null;

export const AppDataSource = {
    get isInitialized() {
        return _appDataSource?.isInitialized || false;
    },
    async initialize() {
        if (!_appDataSource) {
            _appDataSource = new DataSource({
                type: 'postgres',
                host: 'localhost',
                port: 5432,
                username: 'db_user',
                password: 'db_password',
                database: 'csms',
                synchronize: true,
                logging: false,
                entities: [Transaction, MeterValue],
            });
        }
        return _appDataSource.initialize();
    },
    getRepository(entity: any) {
        if (!_appDataSource || !_appDataSource.isInitialized) {
            throw new Error('AppDataSource not initialized');
        }
        return _appDataSource.getRepository(entity);
    }
} as DataSource; 