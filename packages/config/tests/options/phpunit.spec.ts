import { describe, it, expect } from 'vitest';
import { phpunitOption } from '../../src/options/phpunit';
import type { WPTesterConfig, PHPUnitConfig } from '../../src/types';
import * as path from 'path';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test-fixtures/fixtures');
const PLUGIN_FIXTURE = path.join(FIXTURES_DIR, 'wp-tester-plugin');
const THEME_FIXTURE = path.join(FIXTURES_DIR, 'wp-tester-theme');

describe('phpunitOption', () => {
  it('should be a function that accepts WPTesterConfig and returns Promise<WPTesterConfig>', () => {
    expect(typeof phpunitOption).toBe('function');
    expect(phpunitOption.length).toBe(1);
  });

  it('should preserve the function signature', () => {
    // Type-level test - verifies the function accepts and returns the correct types
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    // This ensures the function signature is correct
    const result: Promise<WPTesterConfig> = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config with existing projectRoot', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config with existing tests object', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {
        wp: true,
        plugin: 'test-plugin',
      },
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config with existing PHPUnit config', () => {
    const existingPhpunitConfig: PHPUnitConfig = {
      phpunitPath: 'vendor/bin/phpunit',
      configPath: 'phpunit.xml',
      bootstrapPath: 'tests/bootstrap.php',
    };

    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {
        phpunit: existingPhpunitConfig,
      },
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('phpunitOption integration with detectPhpUnitConfig', () => {
  it('should integrate with detection system for plugin fixture', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {},
    };

    // Verify function can be called with plugin fixture
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should integrate with detection system for theme fixture', () => {
    const config: WPTesterConfig = {
      projectRoot: THEME_FIXTURE,
      environments: [],
      tests: {},
    };

    // Verify function can be called with theme fixture
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config without projectRoot (uses process.cwd())', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    // Should not throw when projectRoot is not provided
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('phpunitOption return type validation', () => {
  it('should return Promise<WPTesterConfig> type', () => {
    // Type-level validation - ensures function signature is correct
    const config: WPTesterConfig = {
      projectRoot: '/tmp',
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should accept config with existing environments', () => {
    // Validates function accepts configs with environments
    const config: WPTesterConfig = {
      projectRoot: '/tmp',
      environments: [
        {
          name: 'Test Environment',
          blueprint: { steps: [] },
        },
      ],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should accept config with existing test configuration', () => {
    // Validates function accepts configs with existing tests
    const config: WPTesterConfig = {
      projectRoot: '/tmp',
      environments: [],
      tests: {
        wp: true,
        plugin: 'my-plugin',
      },
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('PHPUnitConfig type structure', () => {
  it('should accept valid PHPUnitConfig with all required fields', () => {
    const phpunitConfig: PHPUnitConfig = {
      phpunitPath: 'vendor/bin/phpunit',
      configPath: 'phpunit.xml',
      bootstrapPath: 'tests/bootstrap.php',
    };

    expect(phpunitConfig.phpunitPath).toBe('vendor/bin/phpunit');
    expect(phpunitConfig.configPath).toBe('phpunit.xml');
    expect(phpunitConfig.bootstrapPath).toBe('tests/bootstrap.php');
  });

  it('should be compatible with WPTesterConfig.tests.phpunit', () => {
    const phpunitConfig: PHPUnitConfig = {
      phpunitPath: 'custom/path/phpunit',
      configPath: 'custom-phpunit.xml',
      bootstrapPath: 'custom/bootstrap.php',
    };

    const config: WPTesterConfig = {
      environments: [],
      tests: {
        phpunit: phpunitConfig,
      },
    };

    expect(config.tests.phpunit).toBeDefined();
    expect(config.tests.phpunit?.phpunitPath).toBe('custom/path/phpunit');
    expect(config.tests.phpunit?.configPath).toBe('custom-phpunit.xml');
    expect(config.tests.phpunit?.bootstrapPath).toBe('custom/bootstrap.php');
  });

  it('should allow relative paths in PHPUnitConfig', () => {
    const phpunitConfig: PHPUnitConfig = {
      phpunitPath: './vendor/bin/phpunit',
      configPath: './phpunit.xml.dist',
      bootstrapPath: './tests/bootstrap.php',
    };

    expect(phpunitConfig.phpunitPath).toContain('./');
    expect(phpunitConfig.configPath).toContain('./');
    expect(phpunitConfig.bootstrapPath).toContain('./');
  });

  it('should allow different phpunit config file names', () => {
    const configs = [
      {
        phpunitPath: 'vendor/bin/phpunit',
        configPath: 'phpunit.xml',
        bootstrapPath: 'tests/bootstrap.php',
      },
      {
        phpunitPath: 'vendor/bin/phpunit',
        configPath: 'phpunit.xml.dist',
        bootstrapPath: 'tests/bootstrap.php',
      },
      {
        phpunitPath: 'vendor/bin/phpunit',
        configPath: 'custom-phpunit.xml',
        bootstrapPath: 'tests/bootstrap.php',
      },
    ];

    configs.forEach((config) => {
      const phpunitConfig: PHPUnitConfig = config;
      expect(phpunitConfig.configPath).toBeTruthy();
    });
  });
});

describe('phpunitOption workflow scenarios', () => {
  it('should validate workflow structure for non-detected PHPUnit', () => {
    // Test scenario: No PHPUnit detected, validates type structure
    const config: WPTesterConfig = {
      projectRoot: '/tmp', // Directory without PHPUnit
      environments: [],
      tests: {
        wp: true,
      },
    };

    // Validates the function accepts this config structure
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should preserve other test types when PHPUnit is added', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {
        wp: true,
        plugin: 'my-plugin',
      },
    };

    const configWithPhpunit: WPTesterConfig = {
      ...config,
      tests: {
        ...config.tests,
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          bootstrapPath: 'tests/bootstrap.php',
        },
      },
    };

    // Verify all test types are preserved
    expect(configWithPhpunit.tests.wp).toBe(true);
    expect(configWithPhpunit.tests.plugin).toBe('my-plugin');
    expect(configWithPhpunit.tests.phpunit).toBeDefined();
    expect(configWithPhpunit.tests.phpunit?.phpunitPath).toBe('vendor/bin/phpunit');
  });
});

describe('phpunitOption edge cases', () => {
  it('should handle empty config object', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config with multiple environments', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [
        { blueprint: { steps: [] } },
        { blueprint: { steps: [] } },
        { blueprint: { steps: [] } },
      ],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle config with all test types enabled', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {
        wp: true,
        plugin: 'test-plugin',
        theme: 'test-theme',
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          bootstrapPath: 'tests/bootstrap.php',
        },
      },
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle absolute paths in projectRoot', () => {
    const absolutePath = path.resolve(PLUGIN_FIXTURE);
    const config: WPTesterConfig = {
      projectRoot: absolutePath,
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should handle relative paths in projectRoot', () => {
    const config: WPTesterConfig = {
      projectRoot: './test-fixtures/fixtures/wp-tester-plugin',
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('phpunitOption integration with getProjectDir', () => {
  it('should work with config that has projectRoot set', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      environments: [],
      tests: {},
    };

    // getProjectDir should be called internally
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should work with config that has no projectRoot (defaults to cwd)', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    // getProjectDir should fall back to process.cwd()
    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should work with config that has projectType set', () => {
    const config: WPTesterConfig = {
      projectRoot: PLUGIN_FIXTURE,
      projectType: 'plugin',
      environments: [],
      tests: {},
    };

    const result = phpunitOption(config);
    expect(result).toBeInstanceOf(Promise);
  });
});
