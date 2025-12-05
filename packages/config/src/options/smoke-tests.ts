import type { WPTesterConfig, Tests } from '../types';
import * as clack from '@clack/prompts';

export type ProjectType = 'plugin' | 'theme' | 'other';

export function validateSlug(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Slug cannot be empty';
  }
  if (/\s/.test(value)) {
    return 'Slug must be a single word (no spaces)';
  }
  return undefined;
}

export function buildTestsConfig(
  projectType: ProjectType,
  slug?: string
): Tests {
  if (projectType === 'other') {
    return {
      wp: true,
    };
  }

  return {
    wp: true,
    [projectType]: slug as string
  };
}

export async function smokeTestsOption(
  config: Partial<WPTesterConfig>
): Promise<Partial<WPTesterConfig>> {
  const runTests = await clack.confirm({
    message: 'Do you want to run smoke tests?',
    initialValue: true
  });

  if (clack.isCancel(runTests)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (!runTests) {
    return {
      ...config,
      tests: {}
    };
  }

  const projectType = await clack.select({
    message: 'What type of WordPress project is this?',
    options: [
      { value: "plugin", label: "Plugin" },
      { value: "theme", label: "Theme" },
      { value: "other", label: "Other" },
    ],
  });

  if (clack.isCancel(projectType)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (projectType === 'other') {
    return {
      ...config,
      tests: buildTestsConfig('other')
    };
  }

  const slugPrompt = projectType === 'plugin' ? 'Enter the plugin slug:' : 'Enter the theme slug:';
  const slug = await clack.text({
    message: slugPrompt,
    validate: validateSlug
  });

  if (clack.isCancel(slug)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  return {
    ...config,
    tests: buildTestsConfig(projectType as ProjectType, slug)
  };
}
