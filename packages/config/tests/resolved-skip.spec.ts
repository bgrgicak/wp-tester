import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src/config';
import type { WPTesterConfig } from '../src/wp-tester-config';

describe('Resolved config - skip environments', () => {
  it('should default skip to false when not specified', async () => {
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
    expect(resolvedConfig.environments[0].skip).toBe(false);
  });

  it('should preserve skip: true in resolved config', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Skipped Environment',
          skip: true,
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
    expect(resolvedConfig.environments[0].skip).toBe(true);
  });

  it('should preserve skip: false in resolved config', async () => {
    const config: WPTesterConfig = {
      projectType: 'plugin',
      environments: [
        {
          name: 'Enabled Environment',
          skip: false,
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
    expect(resolvedConfig.environments[0].skip).toBe(false);
  });

  it('should handle mixed skip states across multiple environments', async () => {
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
          name: 'Skipped Environment',
          skip: true,
          blueprint: {
            preferredVersions: {
              php: '7.4',
              wp: '6.5'
            }
          }
        },
        {
          name: 'Enabled Environment 2',
          skip: false,
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
    expect(resolvedConfig.environments[0].skip).toBe(false);
    expect(resolvedConfig.environments[1].skip).toBe(true);
    expect(resolvedConfig.environments[2].skip).toBe(false);
  });
});
