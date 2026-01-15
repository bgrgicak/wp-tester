import type { WPTesterConfig } from '../types';
import * as clack from '@clack/prompts';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkingDirectory } from '../config';

export function validatePath(value: string | undefined): string | undefined {
  // Allow empty value - will be replaced with cwd
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const resolvedPath = path.isAbsolute(value)
    ? value
    : path.resolve(getWorkingDirectory(), value);

  if (!fs.existsSync(resolvedPath)) {
    return 'Directory does not exist';
  }

  return undefined;
}

export async function projectRootOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  const cwd = getWorkingDirectory();

  // Single input step: user can press Enter to confirm cwd or type a new path
  const rootPath = await clack.text({
    message: 'Where is your project located? (Press Enter to use current directory)',
    placeholder: cwd,
    initialValue: '',
    validate: validatePath,
  });

  if (clack.isCancel(rootPath)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // If empty (user pressed Enter), use '.' to represent current directory
  const finalPath = !rootPath || rootPath.trim() === '' ? '.' : rootPath;

  // Store the path (using '.' for current directory)
  return {
    ...config,
    projectHostPath: finalPath,
  };
}
