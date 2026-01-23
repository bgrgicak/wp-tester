import { access, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Find the PHPUnit config file (phpunit.xml or phpunit.xml.dist)
 */
export async function findPhpUnitConfig(basePath: string): Promise<string | null> {
  const configFiles = ['phpunit.xml', 'phpunit.xml.dist'];

  for (const file of configFiles) {
    const configPath = join(basePath, file);
    try {
      await access(configPath);
      return configPath;
    } catch {
      // File doesn't exist, continue checking
    }
  }

  return null;
}

/**
 * Find the PHPUnit executable path
 * @param basePath
 */
export async function findPhpUnitExecutable(basePath: string): Promise<string | null> {
  const possiblePaths = [
    join(basePath, 'vendor', 'bin', 'phpunit'),
  ];

  for (const execPath of possiblePaths) {
    try {
      await access(execPath);
      return execPath;
    } catch {
      // File doesn't exist, continue checking
    }
  }

  return null;
}

/**
 * Parse the bootstrap file path from PHPUnit config
 * Returns the bootstrap path or null if not found
 */
export async function parseBootstrapPath(configPath: string): Promise<string | null> {
  try {
    const content = await readFile(configPath, 'utf-8');

    // Simple XML parsing to find bootstrap attribute
    // Look for bootstrap="path/to/bootstrap.php"
    const bootstrapMatch = content.match(/bootstrap\s*=\s*["']([^"']+)["']/);

    if (bootstrapMatch && bootstrapMatch[1]) {
      return bootstrapMatch[1];
    }
  } catch {
    // Failed to read or parse config
  }

  return null;
}

/**
 * Resolve the bootstrap file path for PHPUnit tests
 * Returns the absolute path to the bootstrap file or null if not found
 *
 * Priority order:
 * 1. Explicit bootstrapPath from user config
 * 2. Parse from phpunit.xml config file
 * 3. Fall back to tests/bootstrap.php
 *
 * @param configPath - Absolute path to PHPUnit config file
 * @param projectDir - Absolute path to project directory
 * @param explicitBootstrapPath - Optional explicit bootstrap path from user config (relative or absolute)
 * @returns Absolute path to bootstrap file, or null if not found
 */
export async function resolveBootstrapPath(
  configPath: string,
  projectDir: string,
  explicitBootstrapPath?: string
): Promise<string | null> {
  // Priority 1: Explicit bootstrapPath from config
  if (explicitBootstrapPath) {
    const absoluteBootstrapPath = join(projectDir, explicitBootstrapPath);
    try {
      await access(absoluteBootstrapPath);
      return absoluteBootstrapPath;
    } catch {
      // Explicit path doesn't exist, fall through to other priorities
    }
  }

  // Priority 2: Parse from phpunit.xml
  const parsedBootstrap = await parseBootstrapPath(configPath);
  if (parsedBootstrap) {
    const absoluteBootstrapPath = join(projectDir, parsedBootstrap);
    try {
      await access(absoluteBootstrapPath);
      return absoluteBootstrapPath;
    } catch {
      // Parsed path doesn't exist, try fallback
    }
  }

  // Priority 3: Fallback to tests/bootstrap.php
  const fallbackBootstrap = join(projectDir, 'tests/bootstrap.php');
  try {
    await access(fallbackBootstrap);
    return fallbackBootstrap;
  } catch {
    // No bootstrap found
    return null;
  }
}
