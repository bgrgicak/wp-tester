import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src/config';
import type { WPTesterConfig } from '../src/wp-tester-config';

describe('Resolved config - disabled environments', () => {
  it('should default disabled to false when not specified', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Test Environment',
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

    expect(resolvedConfig.environments).toHaveLength(1);
    expect(resolvedConfig.environments[0].disabled).toBe(false);
  });

  it('should preserve disabled: true in resolved config', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Disabled Environment',
          disabled: true,
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

    expect(resolvedConfig.environments).toHaveLength(1);
    expect(resolvedConfig.environments[0].disabled).toBe(true);
  });

  it('should preserve disabled: false in resolved config', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Enabled Environment',
          disabled: false,
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

    expect(resolvedConfig.environments).toHaveLength(1);
    expect(resolvedConfig.environments[0].disabled).toBe(false);
  });

  it('should handle mixed disabled states across multiple environments', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Enabled Environment 1',
          blueprint: {
            preferredVersions: {
              php: '8.2',
              wp: 'latest'
            }
          }
        },
        {
          name: 'Disabled Environment',
          disabled: true,
          blueprint: {
            preferredVersions: {
              php: '7.4',
              wp: '6.5'
            }
          }
        },
        {
          name: 'Enabled Environment 2',
          disabled: false,
          blueprint: {
            preferredVersions: {
              php: '8.1',
              wp: '6.6'
            }
          }
        }
      ],
      tests: {
        plugin: 'my-plugin'
      }
    };

    const resolvedConfig = await resolveConfig(config);

    expect(resolvedConfig.environments).toHaveLength(3);
    expect(resolvedConfig.environments[0].disabled).toBe(false);
    expect(resolvedConfig.environments[1].disabled).toBe(true);
    expect(resolvedConfig.environments[2].disabled).toBe(false);
  });
});
