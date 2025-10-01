"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manager = void 0;
const logger_1 = require("../logger");
const wsClient_1 = require("./wsClient");
const connectionManager_1 = require("./connectionManager");
exports.manager = new connectionManager_1.ClientManager(); // Экспорт для импортов
const chargePointId = process.argv[2] || 'CP_001'; // ID из arg
async function main() {
    try {
        const ws = await (0, wsClient_1.connectClient)(); // Connect + boot в on('open')
        //    demonstrateOCPPFunctionality()
        logger_1.logger.info(`Client ${chargePointId} ready`);
    }
    catch (err) {
        logger_1.logger.error(`Client error: ${err}`);
    }
}
main();
