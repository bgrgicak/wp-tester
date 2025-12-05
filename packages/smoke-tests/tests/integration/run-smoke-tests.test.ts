import { describe, it, expect } from 'vitest';
import { runSmokeTests } from '../../src/index.js';
import type { WPTesterConfig } from '@wp-tester/config';

describe('runSmokeTests integration', () => {
  it('should run wp tests and return CTRF report', async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: 'Test Environment',
          blueprint: {
            landingPage: '/',
            phpExtensionBundles: ['kitchen-sink']
          }
        }
      ],
      tests: {
        wp: true
      }
    };

    const report = await runSmokeTests(config);

    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.results.summary).toBeDefined();
    expect(report.results.summary.tests).toBeGreaterThan(0);
  }, 60000); // 60s timeout for WordPress boot

  it('should throw error when no tests are configured', async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: 'Test Environment',
          blueprint: { landingPage: '/' }
        }
      ],
      tests: {}
    };

    await expect(runSmokeTests(config)).rejects.toThrow('No test files selected');
  });
});
