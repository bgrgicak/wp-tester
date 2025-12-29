import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src/config';
import type { WPTesterConfig } from '../src/wp-tester-config';

describe('Resolved config - testMode', () => {
  it('should always have testMode defined in resolved config when phpunit is configured', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          blueprint: {
            preferredVersions: {
              php: '8.0',
              wp: 'latest'
            }
          }
        }
      ],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml'
          // testMode is intentionally omitted
        }
      }
    };

    const resolvedConfig = await resolveConfig(config);

    // Verify phpunit config exists
    expect(resolvedConfig.tests.phpunit).toBeDefined();

    // Verify testMode is always defined (not undefined)
    expect(resolvedConfig.tests.phpunit!.testMode).toBeDefined();
    expect(resolvedConfig.tests.phpunit!.testMode).toBe('unit');
  });

  it('should preserve explicit testMode value in resolved config', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          blueprint: {
            preferredVersions: {
              php: '8.0',
              wp: 'latest'
            }
          }
        }
      ],
      tests: {
        phpunit: {
          phpunitPath: 'vendor/bin/phpunit',
          configPath: 'phpunit.xml',
          testMode: 'integration'
        }
      }
    };

    const resolvedConfig = await resolveConfig(config);

    // Verify phpunit config exists
    expect(resolvedConfig.tests.phpunit).toBeDefined();

    // Verify testMode is preserved
    expect(resolvedConfig.tests.phpunit!.testMode).toBe('integration');
  });

  it('should handle config without phpunit', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          blueprint: {
            preferredVersions: {
              php: '8.0',
              wp: 'latest'
            }
          }
        }
      ],
      tests: {
        plugin: 'my-plugin'
      }
    };

    const resolvedConfig = await resolveConfig(config);

    // Verify phpunit config is undefined
    expect(resolvedConfig.tests.phpunit).toBeUndefined();
  });
});
