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
exports.sendCancelReservation = sendCancelReservation;
exports.sendRemoteStartTransaction = sendRemoteStartTransaction;
exports.sendRemoteStopTransaction = sendRemoteStopTransaction;
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
const msgpack = __importStar(require("@msgpack/msgpack"));
function sendRemoteMessage(connectionManager, chargePointId, action, payload) {
    const ws = connectionManager.get(chargePointId);
    if (!ws) {
        logger_1.logger.error(`[RemoteControl] No WebSocket for ${chargePointId} — cannot send ${action}`);
        return;
    }
    const uniqueId = (0, uuid_1.v4)();
    const message = [2, uniqueId, action, payload];
    if (connectionManager.getFormat(chargePointId) === 'binary') {
        try {
            ws.send(msgpack.encode(message));
        }
        catch (err) {
            logger_1.logger.error(`[RemoteControl] sending binary message Error: ${err}`);
        }
    }
    else {
        try {
            ws.send(JSON.stringify(message));
        }
        catch (err) {
            logger_1.logger.error(`[RemoteControl] sending JSON message Error: ${err}`);
        }
    }
    logger_1.logger.info(`[RemoteControl] Sent ${action} to ${chargePointId} (ID: ${uniqueId}): ${JSON.stringify(payload)}`);
}
// Специфическая функция для Reservation Profile
function sendReserveNow(connectionManager, chargePointId, connectorId, idTag, expiryDate) {
    const payload = {
        connectorId,
        expiryDate: expiryDate.toISOString(),
        idTag
    };
    sendRemoteMessage(connectionManager, chargePointId, 'ReserveNow', payload);
}
function sendCancelReservation(connectionManager, chargePointId, reservationId) {
    const payload = { reservationId };
    sendRemoteMessage(connectionManager, chargePointId, 'CancelReservation', payload);
}
function sendRemoteStartTransaction(connectionManager, chargePointId, payload) {
    const fullPayload = {
        idTag: payload.idTag,
        connectorId: payload.connectorId || 1, // Дефолт на первый коннектор
        startValue: payload.startValue || 0 // meterStart
    };
    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStartTransaction', fullPayload);
    logger_1.logger.info(`[RemoteStartTransaction] Sent to ${chargePointId}: idTag=${fullPayload.idTag}, connectorId=${fullPayload.connectorId}, startValue=${fullPayload.startValue}`);
}
function sendRemoteStopTransaction(connectionManager, chargePointId, payload) {
    // OCPP 1.6: RemoteStopTransaction должен содержать ТОЛЬКО transactionId
    const fullPayload = {
        transactionId: typeof payload.transactionId === 'string' ? parseInt(payload.transactionId, 10) : payload.transactionId
    };
    sendRemoteMessage(connectionManager, chargePointId, 'RemoteStopTransaction', fullPayload);
    logger_1.logger.info(`[RemoteStopTransaction] Sent to ${chargePointId}: transactionId=${fullPayload.transactionId}`);
}
