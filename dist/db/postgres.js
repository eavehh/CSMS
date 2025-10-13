"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const Transaction_1 = require("./entities/Transaction");
const MeterValue_1 = require("./entities/MeterValue");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'db_user',
    password: 'db_password',
    database: 'csms',
    synchronize: true, // На проде лучше false + миграции!
    logging: false,
    entities: [Transaction_1.Transaction, MeterValue_1.MeterValue],
});
