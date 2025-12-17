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
