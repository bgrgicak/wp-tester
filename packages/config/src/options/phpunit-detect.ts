import { access, readFile } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Detected PHPUnit configuration
 */
export interface DetectedPHPUnitConfig {
  /**
   * Path to PHPUnit executable (relative to project root)
   */
  phpunitPath: string;

  /**
   * Path to PHPUnit configuration file (relative to project root)
   */
  configPath: string;

  /**
   * Path to PHPUnit bootstrap file (relative to project root)
   */
  bootstrapPath: string;
}

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
 * Find the PHPUnit bootstrap file
 * @param basePath
 */
export async function findPhpUnitBootstrap(basePath: string): Promise<string | null> {
  const bootstrapFiles = ['tests/bootstrap.php'];

  for (const file of bootstrapFiles) {
    const bootstrapPath = join(basePath, file);
    try {
      await access(bootstrapPath);
      return bootstrapPath;
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
 * Detect PHPUnit configuration from a project directory
 * Returns a complete PHPUnit configuration or null if PHPUnit is not detected
 */
export async function detectPhpUnitConfig(
  basePath: string
): Promise<DetectedPHPUnitConfig | null> {
  const configPath = await findPhpUnitConfig(basePath);
  const phpunitPath = await findPhpUnitExecutable(basePath);
  const bootstrapPath = await findPhpUnitBootstrap(basePath);
  if (!configPath || !phpunitPath || !bootstrapPath) {
    return null;
  }
  return {
    phpunitPath: relative(basePath, phpunitPath),
    configPath: relative(basePath, configPath),
    bootstrapPath: relative(basePath, bootstrapPath),
  };
}
