"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMessage = validateMessage;
const ajv_1 = __importDefault(require("ajv")); // npm i ajv @types/ajv
const fs_1 = require("fs");
const path_1 = require("path");
const ajv = new ajv_1.default({ allErrors: true }); // allErrors: все ошибки сразу
const validators = {}; // Кэш валидаторов
// Загружает схему из schemas/1.6/${schemaName}.json
function getValidator(schemaName) {
    if (validators[schemaName])
        return validators[schemaName]; // Из кэша
    try {
        const schemaPath = (0, path_1.join)(__dirname, '../schemas/1.6', `${schemaName}.json`); // Путь к схеме
        const schema = JSON.parse((0, fs_1.readFileSync)(schemaPath, 'utf8'));
        const validate = ajv.compile(schema);
        validators[schemaName] = validate;
        return validate;
    }
    catch (err) {
        console.error(`Схема не найдена для ${schemaName}: ${err.message}`);
        return null;
    }
}
// Основная функция: проверяет data по схеме
function validateMessage(data, schemaName) {
    const validate = getValidator(schemaName);
    if (!validate)
        return { valid: false, errors: [{ message: 'Схема не найдена' }] };
    const valid = validate(data);
    return { valid, errors: validate.errors || [] }; // errors — массив, e.g., "vendor must be string"
}
