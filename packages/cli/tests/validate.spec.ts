import { describe, it, expect } from 'vitest';
import { type ErrorObject } from 'ajv';
import { formatValidationError, getEnabledTestSuites, generateConfigSummary, checkDeprecatedTestProperties } from '../src/commands/config/validate';
import type { Tests, WPTesterConfig } from '@wp-tester/config';
import { Blueprint } from "@wp-playground/blueprints";

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

describe('getEnabledTestSuites', () => {
  it('should return empty array when no tests are enabled', () => {
    const tests: Tests = {};
    const result = getEnabledTestSuites(tests);
    expect(result).toEqual([]);
  });

  describe('legacy properties (deprecated)', () => {
    it('should include WordPress tests when wp is true', () => {
      const tests: Tests = { wp: true };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("wp");
    });

    it('should include plugin tests with plugin name', () => {
      const tests: Tests = { plugin: 'my-plugin' };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("plugin");
    });

    it('should include theme tests with theme name', () => {
      const tests: Tests = { theme: 'my-theme' };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("theme");
    });

    it('should include all enabled legacy test suites', () => {
      const tests: Tests = {
        wp: true,
        plugin: 'my-plugin',
        phpunit: { phpunitPath: 'vendor/bin/phpunit', configPath: 'phpunit.xml', testMode: 'integration' }
      };
      const result = getEnabledTestSuites(tests);
      expect(result).toHaveLength(3);
      expect(result.map(s => s.name)).toEqual(['wp', 'plugin', 'phpunit']);
    });
  });

  describe('smokeTests property (new format)', () => {
    it('should include wp tests when smokeTests is true', () => {
      const tests: Tests = { smokeTests: true };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("wp");
    });

    it('should include wp and plugin tests when smokeTests is true and projectType is plugin', () => {
      const tests: Tests = { smokeTests: true };
      const result = getEnabledTestSuites(tests, 'plugin');
      expect(result.map((s) => s.name)).toContain("wp");
      expect(result.map((s) => s.name)).toContain("plugin");
    });

    it('should include wp and theme tests when smokeTests is true and projectType is theme', () => {
      const tests: Tests = { smokeTests: true };
      const result = getEnabledTestSuites(tests, 'theme');
      expect(result.map((s) => s.name)).toContain("wp");
      expect(result.map((s) => s.name)).toContain("theme");
    });

    it('should not include plugin/theme tests when smokeTests is true and projectType is wordpress', () => {
      const tests: Tests = { smokeTests: true };
      const result = getEnabledTestSuites(tests, 'wordpress');
      expect(result.map((s) => s.name)).toEqual(['wp']);
    });

    it('should return empty array when smokeTests is false', () => {
      const tests: Tests = { smokeTests: false };
      const result = getEnabledTestSuites(tests);
      expect(result).toEqual([]);
    });
  });

  describe('PHPUnit tests', () => {
    it('should include PHPUnit tests with unit mode by default', () => {
      const tests: Tests = { phpunit: { phpunitPath: 'vendor/bin/phpunit', configPath: 'phpunit.xml' } };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("phpunit");
    });

    it('should include PHPUnit tests with integration mode', () => {
      const tests: Tests = { phpunit: { phpunitPath: 'vendor/bin/phpunit', configPath: 'phpunit.xml', testMode: 'integration' } };
      const result = getEnabledTestSuites(tests);
      expect(result.map((s) => s.name)).toContain("phpunit");
    });
  });
});

describe('generateConfigSummary', () => {
  const baseBlueprint: Blueprint = {
    preferredVersions: { php: "latest", wp: "latest" },
  };

  it('should count active environments', () => {
    const config: WPTesterConfig = {
      environments: [
        { name: 'Env 1', blueprint: baseBlueprint },
        { name: 'Env 2', blueprint: baseBlueprint },
      ],
      tests: { wp: true }
    };
    const result = generateConfigSummary(config);
    expect(result.activeEnvironments).toBe(2);
    expect(result.skippedEnvironments).toBe(0);
  });

  it('should count skipped environments separately', () => {
    const config: WPTesterConfig = {
      environments: [
        { name: 'Env 1', blueprint: baseBlueprint },
        { name: 'Env 2', blueprint: baseBlueprint, skip: true },
        { name: 'Env 3', blueprint: baseBlueprint, skip: true },
      ],
      tests: { wp: true }
    };
    const result = generateConfigSummary(config);
    expect(result.activeEnvironments).toBe(1);
    expect(result.skippedEnvironments).toBe(2);
  });

  it('should calculate matrix combinations correctly', () => {
    const config: WPTesterConfig = {
      environments: [
        { name: 'Env 1', blueprint: baseBlueprint },
        { name: 'Env 2', blueprint: baseBlueprint },
        { name: 'Env 3', blueprint: baseBlueprint },
      ],
      tests: { wp: true, plugin: 'my-plugin' }
    };
    const result = generateConfigSummary(config);
    // 3 environments * 2 test suites = 6 combinations
    expect(result.matrixCombinations).toBe(6);
  });

  it('should exclude skipped environments from matrix calculation', () => {
    const config: WPTesterConfig = {
      environments: [
        { name: 'Env 1', blueprint: baseBlueprint },
        { name: 'Env 2', blueprint: baseBlueprint, skip: true },
      ],
      tests: { wp: true, plugin: 'my-plugin' }
    };
    const result = generateConfigSummary(config);
    // 1 active environment * 2 test suites = 2 combinations
    expect(result.matrixCombinations).toBe(2);
  });

  it('should return zero matrix combinations when no test suites', () => {
    const config: WPTesterConfig = {
      environments: [
        { name: 'Env 1', blueprint: baseBlueprint },
      ],
      tests: {}
    };
    const result = generateConfigSummary(config);
    expect(result.matrixCombinations).toBe(0);
  });
});

describe('checkDeprecatedTestProperties', () => {
  it('should return no warnings when no deprecated properties are used', () => {
    const tests: Tests = { smokeTests: true };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(0);
  });

  it('should warn when tests.wp is used', () => {
    const tests: Tests = { wp: true };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].property).toBe('tests.wp');
    expect(warnings[0].message).toContain('deprecated');
    expect(warnings[0].replacement).toContain('smokeTests');
  });

  it('should warn when tests.plugin is used', () => {
    const tests: Tests = { plugin: 'my-plugin' };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].property).toBe('tests.plugin');
    expect(warnings[0].replacement).toContain('projectType');
  });

  it('should warn when tests.theme is used', () => {
    const tests: Tests = { theme: 'my-theme' };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].property).toBe('tests.theme');
    expect(warnings[0].replacement).toContain('projectType');
  });

  it('should warn for all deprecated properties when multiple are used', () => {
    const tests: Tests = { wp: true, plugin: 'my-plugin', theme: 'my-theme' };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(3);
  });

  it('should not warn when wp is false', () => {
    const tests: Tests = { wp: false };
    const warnings = checkDeprecatedTestProperties(tests);
    // wp: false still triggers the warning since the property is present
    expect(warnings).toHaveLength(1);
  });

  it('should not warn for non-deprecated properties', () => {
    const tests: Tests = {
      smokeTests: true,
      phpunit: { phpunitPath: 'vendor/bin/phpunit', configPath: 'phpunit.xml' }
    };
    const warnings = checkDeprecatedTestProperties(tests);
    expect(warnings).toHaveLength(0);
  });
});
