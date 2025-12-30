import { describe, it, expect } from 'vitest';
import type { WPTesterConfig } from '@wp-tester/config';
import { shouldRunPhpunitTests } from '../../src/runner';

describe('shouldRunPhpunitTests', () => {
  it('should return false when phpunit is undefined', () => {
    const config: WPTesterConfig = {
      environments: [],
      tests: {},
    };

    expect(shouldRunPhpunitTests(config)).toBe(false);
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

    expect(shouldRunPhpunitTests(config)).toBe(true);
  });
});
