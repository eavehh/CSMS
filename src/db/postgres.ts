import { DataSource } from 'typeorm'
import { Transaction } from './entities/Transaction';
import { MeterValue } from './entities/MeterValue';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'db_user',
    password: 'db_password',
    database: 'csms',
    synchronize: true, // На проде лучше false + миграции!
    logging: false,
    entities: [Transaction, MeterValue],
}) 