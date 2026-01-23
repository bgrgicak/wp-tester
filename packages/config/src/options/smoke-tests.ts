import type { WPTesterConfig, Tests } from '../types';
import * as clack from '@clack/prompts';
import { getProjectDir } from '../path-utils';

export function validateSlug(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Slug cannot be empty';
  }
  if (/\s/.test(value)) {
    return 'Slug must be a single word (no spaces)';
  }
  return undefined;
}

export async function smokeTestsOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  const tests: Tests = {};

  // Get default slug from project directory name
  const projectHostPath = getProjectDir(config);
  const defaultSlug = projectHostPath.split('/').pop() || '';

  // Ask about WordPress smoke tests
  const runWpTests = await clack.select({
    message: "Run WordPress smoke tests?",
    options: [
      { value: true, label: "Yes", hint: "Verifies WordPress doesn't crash with your code" },
      { value: false, label: "No" },
    ],
    initialValue: true,
  });

  if (clack.isCancel(runWpTests)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (runWpTests) {
    tests.wp = true;
  }

  // Ask about plugin tests if project type is plugin
  if (config.projectType === 'plugin') {
    const runPluginTests = await clack.select({
      message: "Run plugin smoke tests?",
      options: [
        { value: true, label: "Yes", hint: "Verifies your plugin doesn't crash on activation" },
        { value: false, label: "No" },
      ],
      initialValue: true,
    });

    if (clack.isCancel(runPluginTests)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (runPluginTests) {
      const pluginSlug = await clack.text({
        message: "Enter the plugin slug:",
        initialValue: defaultSlug,
        validate: validateSlug,
      });

      if (clack.isCancel(pluginSlug)) {
        clack.cancel("Setup cancelled.");
        process.exit(0);
      }

      tests.plugin = pluginSlug;
    }
  }

  // Ask about theme tests if project type is theme
  if (config.projectType === 'theme') {
    const runThemeTests = await clack.select({
      message: "Run theme smoke tests?",
      options: [
        { value: true, label: "Yes", hint: "Verifies your theme doesn't crash on activation" },
        { value: false, label: "No" },
      ],
      initialValue: true,
    });

    if (clack.isCancel(runThemeTests)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (runThemeTests) {
      const themeSlug = await clack.text({
        message: "Enter the theme slug:",
        initialValue: defaultSlug,
        validate: validateSlug,
      });

      if (clack.isCancel(themeSlug)) {
        clack.cancel("Setup cancelled.");
        process.exit(0);
      }

      tests.theme = themeSlug;
    }
  }

  return {
    ...config,
    tests,
  };
}
