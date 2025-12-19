import { describe, it, expect } from 'vitest';
import type { WPTesterConfig } from '@wp-tester/config';
import { shouldRunPhpUnitTests } from '../../src/runner';

describe('shouldRunPhpUnitTests', () => {
  it('should return false when phpunit is undefined', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    expect(shouldRunPhpUnitTests(config)).toBe(false);
  });

  it('should return true when phpunit config object is provided', () => {
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

    expect(shouldRunPhpUnitTests(config)).toBe(true);
  });
});
