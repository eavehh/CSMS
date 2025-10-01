"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBootNotification = sendBootNotification;
exports.sendHeartbeat = sendHeartbeat;
const msgpack = __importStar(require("@msgpack/msgpack"));
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
const ajvValidator_1 = require("../utils/ajvValidator");
function sendBootNotification(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'BootNotificationRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'BootNotification', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info('Sent BootNotification');
}
function sendHeartbeat(ws, payload, manager) {
    if (!manager.shouldSendHeartbeat()) {
        logger_1.logger.info(`heartbeat is not required (ocpp/v1.6 chapter 4.6 - skip sending)`);
    }
    const message = [2, (0, uuid_1.v4)(), 'Heartbeat', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`heartbeat request`);
}
