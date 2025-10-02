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
exports.sendAuthorize = sendAuthorize;
exports.sendStartTransaction = sendStartTransaction;
exports.sendStopTransaction = sendStopTransaction;
exports.sendStatusNotification = sendStatusNotification;
exports.sendMeterValues = sendMeterValues;
exports.sendRemoteStartTransaction = sendRemoteStartTransaction;
exports.sendRemoteStopTransaction = sendRemoteStopTransaction;
exports.sendChangeConfiguration = sendChangeConfiguration;
exports.sendGetConfiguration = sendGetConfiguration;
const msgpack = __importStar(require("@msgpack/msgpack"));
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
const ajvValidator_1 = require("../utils/ajvValidator");
function sendBootNotification(ws, payload, manager) {
    // if (!validateMessage(payload, 'BootNotificationRequest')) return;
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
function sendAuthorize(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'AuthorizeRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'Authorize', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent Authorize for idTag: ${payload.idTag}`);
}
function sendStartTransaction(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'StartTransactionRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'StartTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent StartTransaction for connector ${payload.connectorId}, idTag: ${payload.idTag}`);
}
function sendStopTransaction(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'StopTransactionRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'StopTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent StopTransaction for transaction ${payload.transactionId}`);
}
function sendStatusNotification(ws, payload, manager) {
    // if (!validateMessage(payload, 'StatusNotificationRequest')) return;
    const message = [2, (0, uuid_1.v4)(), 'StatusNotification', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent StatusNotification for connector ${payload.connectorId}, status: ${payload.status}`);
}
function sendMeterValues(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'MeterValuesRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'MeterValues', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent MeterValues for connector ${payload.connectorId}`);
}
function sendRemoteStartTransaction(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'RemoteStartTransactionRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'RemoteStartTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent RemoteStartTransaction for idTag: ${payload.idTag}`);
}
function sendRemoteStopTransaction(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'RemoteStopTransactionRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'RemoteStopTransaction', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent RemoteStopTransaction for transaction ${payload.transactionId}`);
}
function sendChangeConfiguration(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'ChangeConfigurationRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'ChangeConfiguration', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent ChangeConfiguration for key: ${payload.key}, value: ${payload.value}`);
}
function sendGetConfiguration(ws, payload, manager) {
    if (!(0, ajvValidator_1.validateMessage)(payload, 'GetConfigurationRequest'))
        return;
    const message = [2, (0, uuid_1.v4)(), 'GetConfiguration', payload];
    if (manager.getFormat() === 'binary') {
        ws.send(msgpack.encode(message));
    }
    else {
        ws.send(JSON.stringify(message));
    }
    manager.updateLastSentTime();
    logger_1.logger.info(`Sent GetConfiguration for keys: ${payload.key?.join(', ') || 'all'}`);
}
