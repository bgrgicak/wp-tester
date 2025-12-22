import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import type { ResolvedWPTesterConfig } from '@wp-tester/config';
import { startPlayground, stopPlayground, wpCli, type RunCLIServer } from '@wp-tester/runtime';

// Get config from Vitest's provide/inject
const config = inject('config') as ResolvedWPTesterConfig;
const environments = config.environments;
const themeSlug = config.tests.theme;

// Skip all tests if no theme is configured
describe.skipIf(!themeSlug)('Theme Tests', () => {
  // Test each environment
  describe.each(environments)('Theme Tests - $name', (environment) => {
    let runtime: RunCLIServer;
    let playground: RunCLIServer['playground'];
    let bootError: Error | undefined;

    beforeAll(async () => {
      try {
        runtime = await startPlayground(environment);
        playground = runtime.playground;

        // activate theme
        await wpCli(
          playground,
          [
            'theme',
            'activate',
            themeSlug!,
          ]
        );
      } catch (error) {
        bootError = error as Error;
      }
    });

    afterAll(() => {
      stopPlayground(runtime);
    });

    describe('boot', () => {
      it('should boot without errors', ({ task }) => {
        if (bootError) {
          task.meta['error'] = {
            message: bootError?.message,
            stack: bootError?.stack,
          };
        }
        expect(bootError).toBeUndefined();
      });
    });

    describe.skipIf(bootError)('theme', () => {
      it('should be active', async () => {
        const activeThemes = await wpCli(
          playground,
          [
            'theme',
            'list',
            '--status=active',
            '--field=name',
            '--format=json',
          ]
        );
        expect(activeThemes).toContain(themeSlug);
      });
    });
  });
});
