import { describe, it, expect } from 'vitest';
import type { WPTesterConfig, PHPUnitConfig } from '../../src/types';

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
});
