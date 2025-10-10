import winston from 'winston';
import chalk from 'chalk';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Кастомный формат (аналог вашего примера: префикс o.s.s., класс, поток)
const logFormat = winston.format.printf(({ level, message, timestamp, packagePrefix = 'o.s.s.', className = 'main', thread = 'Thread-1' }) => {
    const color = level === 'info' ? chalk.green : level === 'warn' ? chalk.yellow : level === 'error' ? chalk.red : chalk.gray;
    return `${timestamp} ${color(`[${level.toUpperCase()}]`)} ${packagePrefix}.${className} [${thread}] ${message}`;
});

// Формат для файлов (без цветов)
const fileFormat = winston.format.printf(({ level, message, timestamp, packagePrefix = 'o.s.s.', className = 'main', thread = 'Thread-1' }) => {
    return `${timestamp} [${level.toUpperCase()}] ${packagePrefix}.${className} [${thread}] ${message}`;
});

// Транспорт для консоли (с цветами)
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    )
});

// Транспорт для файлов с ротацией (по дням)
const fileTransport = new DailyRotateFile({
    filename: path.join('logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
    )
});

// Основной логгер (расширяем ваш текущий интерфейс)
const logger_ = winston.createLogger({
    level: 'info',  // 'debug' для большей детализации
    transports: [consoleTransport, fileTransport]
});

// Сохранение вашего текущего интерфейса (методы info, warn, error)
export const logger = {
    info: (message: string, options: { packagePrefix?: string; className?: string; thread?: string } = {}) => {
        logger_.info(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    warn: (message: string, options: { packagePrefix?: string; className?: string; thread?: string } = {}) => {
        logger_.warn(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    error: (message: string, options: { packagePrefix?: string; className?: string; thread?: string } = {}) => {
        logger_.error(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    },
    debug: (message: string, options: { packagePrefix?: string; className?: string; thread?: string } = {}) => {
        logger_.debug(message, {
            packagePrefix: options.packagePrefix || 'o.s.s.',
            className: options.className || 'main',
            thread: options.thread || 'Thread-1'
        });
    }
};

// Если у вас есть logWithContext, интегрируйте
export function logWithContext(level: 'info' | 'warn' | 'error' | 'debug', message: string, packagePrefix: string = 'o.s.s.', className: string = 'main', thread: string = 'Thread-1') {
    logger[level](message, { packagePrefix, className, thread });
}

export default logger;