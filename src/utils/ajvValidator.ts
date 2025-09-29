import Ajv, { ValidateFunction } from 'ajv';  // npm i ajv @types/ajv
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true });  // allErrors: все ошибки сразу

const validators: { [key: string]: ValidateFunction } = {};  // Кэш валидаторов

// Загружает схему из schemas/1.6/${schemaName}.json
function getValidator(schemaName: string): ValidateFunction | null {
  if (validators[schemaName]) return validators[schemaName];  // Из кэша

  try {
    const schemaPath = join(__dirname, '../schemas/1.6', `${schemaName}.json`);  // Путь к схеме
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const validate = ajv.compile(schema);
    validators[schemaName] = validate;
    return validate;
  } catch (err) {
    console.error(`Схема не найдена для ${schemaName}: ${(err as any).message}`);
    return null;
  }
}

// Основная функция: проверяет data по схеме
export function validateMessage(data: any, schemaName: string): { valid: boolean; errors?: any[] } {
  const validate = getValidator(schemaName);
  if (!validate) return { valid: false, errors: [{ message: 'Схема не найдена' }] };

  const valid = validate(data);
  return { valid, errors: validate.errors || [] };  // errors — массив, e.g., "vendor must be string"
}