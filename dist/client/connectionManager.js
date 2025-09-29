"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientManager = void 0;
class ClientManager {
    constructor() {
        this.format = 'json';
    }
    setFormat(format) {
        this.format = format;
    }
    getFormat() {
        return this.format;
    }
}
exports.ClientManager = ClientManager;
