import { describe, it, expect } from 'vitest';
import { type ErrorObject } from 'ajv';
import { formatValidationError } from '../src/commands/config/validate';

describe('formatValidationError', () => {
  it('should format additionalProperties error', () => {
    const error: ErrorObject = {
      keyword: 'additionalProperties',
      instancePath: '',
      schemaPath: '#/additionalProperties',
      params: { additionalProperty: 'reportering' },
      message: 'must NOT have additional properties'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('Unknown property');
    expect(result.message).toContain('reportering');
    expect(result.hint).toContain('not recognized');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=configuration-options');
  });

  it('should format required property error', () => {
    const error: ErrorObject = {
      keyword: 'required',
      instancePath: '',
      schemaPath: '#/required',
      params: { missingProperty: 'tests' },
      message: 'must have required property \'tests\''
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('Missing required property');
    expect(result.message).toContain('tests');
    expect(result.hint).toContain('required');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=tests');
  });

  it('should format enum error', () => {
    const error: ErrorObject = {
      keyword: 'enum',
      instancePath: '/projectType',
      schemaPath: '#/properties/projectType/enum',
      params: { allowedValues: ['plugin', 'theme', 'wordpress', 'wp-content', 'other'] },
      message: 'must be equal to one of the allowed values'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('Invalid value');
    expect(result.message).toContain('/projectType');
    expect(result.hint).toContain('Allowed values');
    expect(result.hint).toContain('plugin');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=configuration-options');
  });

  it('should format type error', () => {
    const error: ErrorObject = {
      keyword: 'type',
      instancePath: '/environments',
      schemaPath: '#/properties/environments/type',
      params: { type: 'array' },
      message: 'must be array'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('Type error');
    expect(result.message).toContain('/environments');
    expect(result.hint).toContain('array');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=environments');
  });

  it('should format minItems error', () => {
    const error: ErrorObject = {
      keyword: 'minItems',
      instancePath: '/environments',
      schemaPath: '#/properties/environments/minItems',
      params: { limit: 1 },
      message: 'must NOT have fewer than 1 items'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('too short');
    expect(result.message).toContain('/environments');
    expect(result.hint).toContain('Minimum items required:');
    expect(result.hint).toContain('1');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=environments');
  });

  it('should format type error for nested property', () => {
    const error: ErrorObject = {
      keyword: 'type',
      instancePath: '/tests/wp',
      schemaPath: '#/properties/tests/properties/wp/type',
      params: { type: 'boolean' },
      message: 'must be boolean'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('Type error');
    expect(result.message).toContain('/tests/wp');
    expect(result.hint).toContain('boolean');
    // Should link to the parent 'tests' section
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration?id=tests');
  });

  it('should format unknown error types with default handler', () => {
    const error: ErrorObject = {
      keyword: 'pattern',
      instancePath: '/someField',
      schemaPath: '#/properties/someField/pattern',
      params: { pattern: '^[a-z]+$' },
      message: 'must match pattern'
    };

    const result = formatValidationError(error);

    expect(result.message).toContain('/someField');
    expect(result.message).toContain('must match pattern');
    expect(result.docsUrl).toBe('https://bgrgicak.github.io/wp-tester/#/configuration');
  });
});
