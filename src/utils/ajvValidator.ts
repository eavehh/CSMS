import Ajv, { ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true });
const validators: { [key: string]: ValidateFunction } = {};

function getValidator(schemaName: string): ValidateFunction | null {
  if (validators[schemaName]) return validators[schemaName];

  try {
    // Фикс пути: от utils/ к src/schemas/1.6/
    const schemaPath = join(__dirname, './schemas/', `${schemaName}.json`);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const validate = ajv.compile(schema);
    validators[schemaName] = validate;
    return validate;
  } catch (err) {
    console.error(`Схема не найдена для ${schemaName}: ${(err as any).message}`);
    return null;
  }
}

export function validateMessage(data: any, schemaName: string): { valid: boolean; errors?: any[] } {
  const validate = getValidator(schemaName);
  if (!validate) return { valid: false, errors: [{ message: 'Схема не найдена' }] };

  const valid = validate(data);
  return { valid, errors: validate.errors || [] };
}