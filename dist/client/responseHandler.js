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
exports.handleResponse = handleResponse;
const msgpack = __importStar(require("@msgpack/msgpack"));
const logger_1 = require("../logger");
const index_1 = require("./index"); // Ок, если index экспортирует
function handleResponse(data, isBinary, ws) {
    let message;
    if (isBinary) {
        try {
            message = msgpack.decode(data);
        }
        catch (err) {
            logger_1.logger.error(`Failed to decode MessagePack response: ${err.message}`);
            return; // Не отправляй error — клиент не сервер
        }
    }
    else {
        try {
            message = JSON.parse(data.toString());
        }
        catch (err) {
            logger_1.logger.error(`Failed to parse JSON response: ${err.message}`);
            return;
        }
    }
    const [messageType, uniqueId, response] = message;
    logger_1.logger.info(`Response received: type ${messageType}, uniqueId ${uniqueId}, response ${JSON.stringify(response)}`);
    if (messageType === 3) {
        if (response.format) {
            index_1.manager.setFormat(response.format);
        }
        if (response.status) {
            const bootResp = response;
            if (bootResp.status === 'Accepted') {
                logger_1.logger.info(`Boot accepted. Time: ${bootResp.currentTime}, Interval: ${bootResp.interval}`);
            }
            else {
                logger_1.logger.error(`Boot rejected: ${bootResp.status}`);
            }
        }
    }
    else if (messageType === 4) { // CallError
        logger_1.logger.error(`Error from server: ${response.errorCode || 'Unknown'}`);
    }
}
