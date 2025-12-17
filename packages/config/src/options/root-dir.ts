import type { WPTesterConfig } from '../types';
import * as clack from '@clack/prompts';
import * as path from 'path';
import * as fs from 'fs';

export function validatePath(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Path cannot be empty';
  }

  const resolvedPath = path.isAbsolute(value)
    ? value
    : path.resolve(process.cwd(), value);

  if (!fs.existsSync(resolvedPath)) {
    return 'Directory does not exist';
  }

  return undefined;
}

export async function rootDirOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  const cwd = process.cwd();

  const isCwdRoot = await clack.confirm({
    message: `Is ${cwd} the project root directory?`,
    initialValue: true,
  });

  if (clack.isCancel(isCwdRoot)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // If CWD is the root, omit rootDir from config (uses default)
  if (isCwdRoot) {
    return config;
  }

  // Prompt for the project root path
  const rootPath = await clack.text({
    message: 'Enter the path to your project root:',
    validate: validatePath,
  });

  if (clack.isCancel(rootPath)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  // Store the path exactly as the user provided it
  return {
    ...config,
    rootDir: rootPath,
  };
}
