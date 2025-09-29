"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectClient = connectClient;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../logger");
const responseHandler_1 = require("./responseHandler");
const messageSender_1 = require("./messageSender");
const connectionManager_1 = require("./connectionManager"); // Импорт класса
const manager = new connectionManager_1.ClientManager(); // Создай здесь
async function connectClient() {
    return new Promise((resolve, reject) => {
        const ws = new ws_1.default('ws://localhost:8000/ocpp?chargeBoxIdentity=CP_001');
        ws.on("open", () => {
            logger_1.logger.info("Charge point connected");
            (0, messageSender_1.sendBootNotification)(ws, { chargePointVendor: 'VendorTest', chargePointModel: 'ModelTest', chargeBoxSerialNumber: 'SN123', firmwareVersion: '1.0' }, manager); // Добавь manager
            resolve(ws);
        });
        ws.on("message", (data, isBinary) => {
            (0, responseHandler_1.handleResponse)(data, isBinary, ws);
        });
        ws.on("close", () => {
            logger_1.logger.info("Charge point disconnected");
        });
        ws.on("error", (err) => {
            logger_1.logger.error(`Charge point error: ${err.message}`);
            reject(err);
        });
    });
}
