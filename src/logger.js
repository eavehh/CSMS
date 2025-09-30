"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: function (msg) { return console.log("[INFO] ".concat(new Date().toISOString(), " ").concat(msg)); },
    error: function (msg) { return console.error("[ERROR] ".concat(new Date().toISOString(), " ").concat(msg)); },
    boot: function (msg) { return console.log("[BOOT] ".concat(new Date().toISOString(), " ").concat(msg)); }
};
