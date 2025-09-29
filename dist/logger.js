"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
    boot: (msg) => console.log(`[BOOT] ${new Date().toISOString()} ${msg}`)
};
