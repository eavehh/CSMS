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
exports.sendRemoteMessage = sendRemoteMessage;
exports.sendReserveNow = sendReserveNow;
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
const msgpack = __importStar(require("@msgpack/msgpack"));
function sendRemoteMessage(connectionManager, chargePointId, action, payload) {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger_1.logger.error(`No active WebSocket for ${chargePointId} — cannot send ${action}`);
        return;
    }
    const uniqueId = (0, uuid_1.v4)();
    // Ключевой вызов: Сохраняем pending перед отправкой
    connectionManager.setPendingRequest(uniqueId, action);
    const message = [2, uniqueId, action, payload];
    const format = connectionManager.getFormat(chargePointId);
    if (format === 'binary') {
        try {
            ws.send(msgpack.encode(message));
            logger_1.logger.info(`[RemoteControl] binary message sent: ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
        }
        catch (err) {
            logger_1.logger.error(`[RemoteControl] Faild to send a binary message: ${err}`);
            return;
        }
    }
    else {
        try {
            ws.send(JSON.stringify(message));
            logger_1.logger.info(`[RemoteControl] JSON message sent: ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
        }
        catch (err) {
            logger_1.logger.error(`[RemoteControl] Faild to send a JSON message: ${err}`);
        }
    }
}
// Пример для ReserveNow
function sendReserveNow(connectionManager, chargePointId, connectorId, idTag, expiryDate) {
    const payload = {
        connectorId,
        expiryDate: expiryDate.toISOString(),
        idTag
    };
    sendRemoteMessage(connectionManager, chargePointId, 'ReserveNow', payload);
}
