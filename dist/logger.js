"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.logger = {
    info: (msg) => console.log(`${(new Date()).toISOString()}`, chalk_1.default.green(`INFO `), `${msg}`),
    warn: (msg) => console.log(`${(new Date()).toISOString()}`, chalk_1.default.yellow(`WARN `), `${msg}`),
    error: (msg) => console.log(`${(new Date()).toISOString()}`, chalk_1.default.red(`ERROR`), `${msg}`),
    debug: (msg) => console.log(`${(new Date()).toISOString()}`, chalk_1.default.gray(`DEBUG`), `${msg}`)
};
