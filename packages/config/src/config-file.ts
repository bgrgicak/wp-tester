import type { WPTesterConfig } from "./wp-tester-config";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { configPath, normalizeConfigPath } from "./path-utils";
import { pathToFileURL } from "url";

/**
 * Helper function for defining wp-tester configuration with full type safety.
 * Use this in wp-tester.js or wp-tester.ts files for IDE autocomplete and type checking.
 *
 * @example
 * // wp-tester.js
 * import { defineConfig } from '@wp-tester/config';
 *
 * export default defineConfig({
 *   environments: [{ blueprint: { preferredVersions: { php: '8.2', wp: 'latest' } } }],
 *   tests: { plugin: 'my-plugin' },
 * });
 *
 * @example
 * // wp-tester.ts with environment variables
 * import { defineConfig } from '@wp-tester/config';
 *
 * export default defineConfig({
 *   environments: [{
 *     blueprint: {
 *       preferredVersions: { php: process.env.PHP_VERSION || '8.2', wp: 'latest' }
 *     }
 *   }],
 *   tests: { plugin: process.env.PLUGIN_SLUG || 'my-plugin' },
 * });
 */
export function defineConfig(config: WPTesterConfig): WPTesterConfig {
  return config;
}

export function getDefaultConfig(): WPTesterConfig {
  return {
    $schema:
      "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json",
    environments: [
      {
        name: "Latest WordPress and PHP",
        blueprint: {
          preferredVersions: {
            php: "latest",
            wp: "latest",
          },
        },
      },
    ],
    tests: {},
  };
}

export async function isConfigWritable(): Promise<boolean> {
  try {
    await access(configPath(), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a config file.
 * Supports JSON files (.json), JavaScript files (.js), and TypeScript files (.ts).
 * For JS/TS files, the module must export a default configuration object.
 *
 * @param path - Path to the config file (optional, defaults to auto-detected config file)
 * @returns Parsed configuration object
 * @throws Error if the file cannot be read or parsed
 *
 * @example
 * // Read from default location (auto-detected)
 * const config = await readConfigFile();
 *
 * @example
 * // Read from specific JSON file
 * const config = await readConfigFile('./wp-tester.json');
 *
 * @example
 * // Read from JS/TS file
 * const config = await readConfigFile('./wp-tester.ts');
 */
export async function readConfigFile(path?: string): Promise<WPTesterConfig> {
  if (!path) {
    path = configPath();
  }

  // Normalize the path (handles directory paths)
  path = normalizeConfigPath(path);

  // Check if this is a JS/TS file
  const ext = path.toLowerCase();
  if (ext.endsWith('.js') || ext.endsWith('.ts')) {
    return loadJsOrTsConfig(path);
  }

  // Default to JSON parsing
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as WPTesterConfig;
}

/**
 * Type for a dynamically imported config module.
 */
interface ConfigModule {
  default?: WPTesterConfig;
}

/**
 * Load a configuration from a JavaScript or TypeScript file.
 * The file must have a default export that is a WPTesterConfig object.
 *
 * @param filePath - Absolute path to the JS/TS config file
 * @returns Parsed configuration object
 * @throws Error if the module doesn't have a valid default export
 */
async function loadJsOrTsConfig(filePath: string): Promise<WPTesterConfig> {
  // Convert path to file URL for proper cross-platform support
  const fileUrl = pathToFileURL(filePath).href;

  // Add cache-busting query parameter to force reload on file changes
  const urlWithCacheBust = `${fileUrl}?t=${Date.now()}`;

  // Dynamic import the module
  const module = await import(urlWithCacheBust) as ConfigModule;

  // Get the config from default export
  const config = module.default;

  if (!config || typeof config !== 'object') {
    throw new Error(
      `Invalid config file: ${filePath}\n` +
      `Expected a default export of type WPTesterConfig.\n` +
      `Example:\n` +
      `  import { defineConfig } from '@wp-tester/config';\n` +
      `  export default defineConfig({ ... });`
    );
  }

  return config;
}

export async function writeConfigFile(
  config: WPTesterConfig,
  path?: string
): Promise<void> {
  if (!path) {
    path = configPath();
  }
  await writeFile(path, JSON.stringify(config, null, 2), "utf8");
}
