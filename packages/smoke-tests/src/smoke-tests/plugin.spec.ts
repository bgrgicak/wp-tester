import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import type { ResolvedWPTesterConfig } from '@wp-tester/config';
import { startPlayground, stopPlayground, wpCli, type RunCLIServer } from '@wp-tester/runtime';

// Get config from Vitest's provide/inject
const config = inject('config') as ResolvedWPTesterConfig;
// Filter out disabled environments
const environments = config.environments.filter(env => !env.disabled);
const pluginSlug = config.tests.plugin;

// Test each environment
if (pluginSlug) {
  for (const environment of environments) {
    describe(`${environment.name} - Plugin Smoke Tests`, () => {
      let runtime: RunCLIServer;
      let playground: RunCLIServer["playground"];
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

      it("should boot WordPress without errors", ({ task }) => {
        if (bootError) {
          task.meta["error"] = {
            message: bootError?.message,
            stack: bootError?.stack,
          };
        }
        expect(bootError).toBeUndefined();
      });

      describe.skipIf(bootError)("Plugin", () => {
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
  }
}
