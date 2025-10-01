"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnChargePointClient = spawnChargePointClient;
const child_process_1 = require("child_process");
const logger_1 = require("../logger"); // Общий лог
function spawnChargePointClient(chargePointId) {
    const child = (0, child_process_1.spawn)('node', ['dist/client/index.js', chargePointId], { stdio: 'pipe' });
    child.stdout.on('data', (data) => logger_1.logger.info(`Client ${chargePointId}: ${data}`));
    child.stderr.on('data', (data) => logger_1.logger.error(`Client ${chargePointId}: ${data}`));
    child.on('close', (code) => logger_1.logger.info(`Client ${chargePointId} closed: ${code}`));
    // Передай ID в клиент (через arg, в index.ts process.argv[2])
    return child;
}
