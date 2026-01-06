import { describe, it, expect } from 'vitest';
import type { WPTesterConfig } from '../../src/types';

describe('PHPUnitConfig type', () => {
  it('should accept PHPUnit config object with all required fields', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          bootstrapPath: 'tests/bootstrap.php',
        },
      },
    };

    expect(config.tests.phpunit).toBeDefined();
    expect(config.tests.phpunit).toHaveProperty('phpunitPath');
    expect(config.tests.phpunit).toHaveProperty('configPath');
    expect(config.tests.phpunit).toHaveProperty('bootstrapPath');
  });

  it('should accept undefined phpunit config', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    expect(config.tests.phpunit).toBeUndefined();
  });

  it('should accept testMode field with valid values', () => {
    const configUnit: WPTesterConfig = {
      environments: [],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          testMode: 'unit',
        },
      },
    };

    const configIntegration: WPTesterConfig = {
      environments: [],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          testMode: 'integration',
        },
      },
    };

    expect(configUnit.tests.phpunit?.testMode).toBe('unit');
    expect(configIntegration.tests.phpunit?.testMode).toBe('integration');
  });

  it('should allow testMode to be undefined (defaults to unit)', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
        },
      },
    };

    expect(config.tests.phpunit?.testMode).toBeUndefined();
  });
});
