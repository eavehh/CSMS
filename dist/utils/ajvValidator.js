"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMessage = validateMessage;
const ajv_1 = __importDefault(require("ajv"));
const fs_1 = require("fs");
const path_1 = require("path");
const ajv = new ajv_1.default({ allErrors: true });
const validators = {};
function getValidator(schemaName) {
    if (validators[schemaName])
        return validators[schemaName];
    try {
        // Фикс пути: от utils/ к src/schemas/1.6/
        const schemaPath = (0, path_1.join)(__dirname, './schemas/', `${schemaName}.json`);
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
function validateMessage(data, schemaName) {
    const validate = getValidator(schemaName);
    if (!validate)
        return { valid: false, errors: [{ message: 'Схема не найдена' }] };
    const valid = validate(data);
    return { valid, errors: validate.errors || [] };
}
