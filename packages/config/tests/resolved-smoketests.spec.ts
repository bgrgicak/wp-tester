import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src';
import type { WPTesterConfig } from '../src/wp-tester-config';

describe('Resolved config - smokeTests', () => {
  it('should pass through smokeTests boolean true', async () => {
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
        smokeTests: true,
      }
    };

    const resolvedConfig = await resolveConfig(config);
    expect(resolvedConfig.tests.smokeTests).toBe(true);
  });

  it('should pass through smokeTests boolean false', async () => {
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
        smokeTests: false,
      }
    };

    const resolvedConfig = await resolveConfig(config);
    expect(resolvedConfig.tests.smokeTests).toBe(false);
  });

  it('should pass through smokeTests with include', async () => {
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
        smokeTests: { include: ['wpBoot', 'wpAdminLoads'] },
      }
    };

    const resolvedConfig = await resolveConfig(config);
    expect(resolvedConfig.tests.smokeTests).toEqual({ include: ['wpBoot', 'wpAdminLoads'] });
  });

  it('should pass through smokeTests with exclude', async () => {
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
        smokeTests: { exclude: ['wpRestApiAvailable'] },
      }
    };

    const resolvedConfig = await resolveConfig(config);
    expect(resolvedConfig.tests.smokeTests).toEqual({ exclude: ['wpRestApiAvailable'] });
  });

  it('should throw error when both include and exclude are specified', async () => {
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
        smokeTests: {
          include: ['wpBoot'],
          exclude: ['wpAdminLoads'],
        } as any, // Type system should prevent this but we test runtime
      }
    };

    await expect(resolveConfig(config)).rejects.toThrow(
      "smokeTests cannot have both 'include' and 'exclude'. Use one or the other."
    );
  });

  it('should handle config without smokeTests (undefined)', async () => {
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
        wp: true,
      }
    };

    const resolvedConfig = await resolveConfig(config);
    expect(resolvedConfig.tests.smokeTests).toBeUndefined();
  });
});
