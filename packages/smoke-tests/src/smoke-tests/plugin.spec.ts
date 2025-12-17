import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import type { WPTesterConfig } from '@wp-tester/config';
import { startPlayground, stopPlayground, wpCli, type RunCLIServer } from '@wp-tester/runtime';

// Get config from Vitest's provide/inject
const config = inject('config') as WPTesterConfig;
const environments = config.environments;
const pluginSlug = config.tests.plugin;

// Skip all tests if no plugin is configured
describe.skipIf(!pluginSlug)('Plugin Tests', () => {
  // Test each environment
  describe.each(environments)('Plugin Tests - $name', (environment) => {
    let runtime: RunCLIServer;
    let playground: RunCLIServer['playground'];
    let bootError: Error | undefined;

    beforeAll(async () => {
      try {
        runtime = await startPlayground(environment);
        playground = runtime.playground;

        // activate plugin
        await wpCli(playground, ["plugin", "activate", pluginSlug!]);
      } catch (error) {
        bootError = error as Error;
      }
    });

    afterAll(() => {
      stopPlayground(runtime);
    });

    describe("boot", () => {
      it("should boot without errors", ({ task }) => {
        if (bootError) {
          task.meta["error"] = {
            message: bootError?.message,
            stack: bootError?.stack,
          };
        }
        expect(bootError).toBeUndefined();
      });
    });

    describe.skipIf(bootError)("plugin", () => {
      it("should be active", async () => {
        const activePlugins = await wpCli(playground, [
          "plugin",
          "list",
          "--status=active",
          "--field=name",
          "--format=json",
        ]);
        expect(activePlugins).toContain(pluginSlug);
      });
    });
  });
});
