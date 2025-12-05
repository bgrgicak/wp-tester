import { describe, it, expect } from 'vitest';
import { getDefaultConfig, getSchemaPath } from '../src/index';
import { existsSync, readFileSync } from 'fs';

describe('Config Package Functionality', () => {
  it('getDefaultConfig returns a valid wp-tester configuration', () => {
    const defaultConfig = getDefaultConfig();

    // Must have environments with at least one environment
    expect(Array.isArray(defaultConfig.environments)).toBe(true);
    expect(defaultConfig.environments?.length).toBeGreaterThan(0);

    // First environment must have valid structure
    const firstEnv = defaultConfig.environments?.[0];
    expect(firstEnv).toHaveProperty('name');
    expect(firstEnv).toHaveProperty('blueprint');
    expect(firstEnv?.blueprint).toHaveProperty('preferredVersions');

    // Must have tests object
    expect(defaultConfig.tests).toBeDefined();

    // Must have reporters
    expect(Array.isArray(defaultConfig.reporters)).toBe(true);
  });

  it('getSchemaPath returns a path to an existing schema file', () => {
    const schemaPath = getSchemaPath();
    expect(existsSync(schemaPath)).toBe(true);

    // Verify it's actually a valid JSON schema
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    expect(schema).toHaveProperty('$schema');
    expect(schema).toHaveProperty('type');
    expect(schema.type).toBe('object');
  });
});
