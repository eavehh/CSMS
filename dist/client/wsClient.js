"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manager = void 0;
exports.connectClient = connectClient;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../logger");
const responseHandler_1 = require("./responseHandler");
const messageSender_1 = require("./messageSender");
const connectionManager_1 = require("./connectionManager");
const manager = new connectionManager_1.ClientManager(); // Создаем с дефолтным ID
exports.manager = manager;
async function connectClient(chargePointId) {
    const cpId = chargePointId || process.argv[2] || 'CP_001';
    // Обновляем manager с правильным ID
    manager.chargePointManager = new (require('./stateManager').ChargePointManager)(cpId);
    return new Promise((resolve, reject) => {
        const ws = new ws_1.default(`ws://localhost:8000/ocpp?chargeBoxIdentity=${cpId}`);
        ws.on("open", () => {
            logger_1.logger.info(`Charge point ${cpId} connected`);
            (0, messageSender_1.sendBootNotification)(ws, {
                chargePointVendor: 'VendorTest',
                chargePointModel: 'ModelTest',
                chargeBoxSerialNumber: cpId,
                firmwareVersion: '1.0'
            }, manager);
            resolve(ws);
        });
        ws.on("message", (data, isBinary) => {
            (0, responseHandler_1.handleResponse)(data, isBinary, ws);
        });
        ws.on("close", () => {
            logger_1.logger.info(`Charge point ${cpId} disconnected`);
        });
        ws.on("error", (err) => {
            logger_1.logger.error(`Charge point ${cpId} error: ${err.message}`);
            reject(err);
        });
    });
}
