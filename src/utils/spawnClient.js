"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnChargePointClient = spawnChargePointClient;
var child_process_1 = require("child_process");
var logger_1 = require("../logger"); // Общий лог
function spawnChargePointClient(chargePointId) {
    var child = (0, child_process_1.spawn)('node', ['dist/client/index.js', chargePointId], { stdio: 'pipe' });
    child.stdout.on('data', function (data) { return logger_1.logger.info("Client ".concat(chargePointId, ": ").concat(data)); });
    child.stderr.on('data', function (data) { return logger_1.logger.error("Client ".concat(chargePointId, ": ").concat(data)); });
    child.on('close', function (code) { return logger_1.logger.info("Client ".concat(chargePointId, " closed: ").concat(code)); });
    // Передай ID в клиент (через arg, в index.ts process.argv[2])
    return child;
}
