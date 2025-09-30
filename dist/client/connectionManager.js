"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientManager = void 0;
class ClientManager {
    constructor() {
        this.format = 'json';
        this.lastSentTime = 0;
        this.interval = 60; // дефолт
    }
    setFormat(format) {
        this.format = format;
    }
    getFormat() {
        return this.format;
    }
    updateInterval(newInterval) {
        this.interval = newInterval;
    }
    updateLastSentTime() {
        this.lastSentTime = Date.now();
    }
    shouldSendHeartbeat() {
        const timePassed = Date.now() - this.lastSentTime;
        return timePassed >= this.interval * 1000; // Если прошло >= interval секунд — отправь
    }
}
exports.ClientManager = ClientManager;
