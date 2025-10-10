"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logWithContext = logWithContext;
const winston_1 = __importDefault(require("winston"));
const chalk_1 = __importDefault(require("chalk"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
// Кастомный формат (аналог вашего примера: префикс o.s.s., класс, поток)
const logFormat = winston_1.default.format.printf(({ level, message, timestamp, packagePrefix = 'o.s.s.', className = 'main', thread = 'Thread-1' }) => {
    const color = level === 'info' ? chalk_1.default.green : level === 'warn' ? chalk_1.default.yellow : level === 'error' ? chalk_1.default.red : chalk_1.default.gray;
    return `${timestamp} ${color(`[${level.toUpperCase()}]`)} ${packagePrefix}.${className} [${thread}] ${message}`;
});
// Формат для файлов (без цветов)
const fileFormat = winston_1.default.format.printf(({ level, message, timestamp, packagePrefix = 'o.s.s.', className = 'main', thread = 'Thread-1' }) => {
    return `${timestamp} [${level.toUpperCase()}] ${packagePrefix}.${className} [${thread}] ${message}`;
});
// Транспорт для консоли (с цветами)
const consoleTransport = new winston_1.default.transports.Console({
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
});
// Транспорт для файлов с ротацией (по дням)
const fileTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join('logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileFormat)
});
// Основной логгер (расширяем ваш текущий интерфейс)
const logger_ = winston_1.default.createLogger({
    level: 'info', // 'debug' для большей детализации
    transports: [consoleTransport, fileTransport]
});
// Сохранение вашего текущего интерфейса (методы info, warn, error)
exports.logger = {
    info: (message, options = {}) => {
        logger_.info(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    warn: (message, options = {}) => {
        logger_.warn(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    error: (message, options = {}) => {
        logger_.error(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    debug: (message, options = {}) => {
        logger_.debug(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    }
};
// Если у вас есть logWithContext, интегрируйте
function logWithContext(level, message, packagePrefix = 'o.s.s.', className = 'main', thread = 'Thread-1') {
    exports.logger[level](message, { packagePrefix, className, thread });
}
exports.default = exports.logger;
