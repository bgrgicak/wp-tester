import type { WPTesterConfig } from "./wp-tester-config";
import type { ResolvedPath } from "./resolved-types";
import { existsSync, statSync } from "fs";
import { join, dirname, resolve, isAbsolute, extname } from "path";
import { fileURLToPath } from "url";
import { hostToVfs } from './path-mappers';

/**
 * Supported config file extensions in priority order.
 * TypeScript files take priority, followed by JavaScript, then JSON.
 */
export const CONFIG_EXTENSIONS = ['.ts', '.js', '.json'] as const;
export type ConfigExtension = typeof CONFIG_EXTENSIONS[number];

/**
 * Default config file base name (without extension).
 */
export const CONFIG_BASE_NAME = 'wp-tester';

/**
 * Get the actual working directory, accounting for tools like tsx that may change process.cwd()
 * When running via npx or tsx, INIT_CWD contains the original directory where the command was invoked
 */
export function getWorkingDirectory(): string {
  return process.env.INIT_CWD || process.cwd();
}

/**
 * Resolve a path to an absolute path.
 * If the path is already absolute, return it as-is.
 * Otherwise, resolve it relative to the base directory.
 *
 * @param path - Path to resolve (relative or absolute)
 * @param baseDir - Base directory to resolve relative paths from
 * @returns Absolute path
 */
export function resolveAbsolute(path: string, baseDir: string): string {
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

/**
 * Get the default config file path.
 * Searches for wp-tester.ts, wp-tester.js, or wp-tester.json in the working directory.
 * Returns the first found, or defaults to wp-tester.json if none exist.
 */
export function configPath(): string {
  const workDir = getWorkingDirectory();
  return findConfigFile(workDir) || join(workDir, "wp-tester.json");
}

/**
 * Find a config file in the given directory.
 * Searches for config files in priority order: .ts, .js, .json
 *
 * @param dir - Directory to search in
 * @returns Path to the first found config file, or null if none found
 */
export function findConfigFile(dir: string): string | null {
  for (const ext of CONFIG_EXTENSIONS) {
    const filePath = join(dir, `${CONFIG_BASE_NAME}${ext}`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Check if a path is a JavaScript or TypeScript config file.
 *
 * @param filePath - Path to check
 * @returns True if the path has a .js or .ts extension
 */
export function isJsOrTsConfig(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return ext === '.js' || ext === '.ts';
}

export function getSchemaPath(importMetaUrl?: string): string {
  // For ESM in production (built files) - use import.meta.url from this module
  // This works when the package is installed via npm or run via npx
  const metaUrl = importMetaUrl || import.meta.url;
  if (metaUrl) {
    const currentDir = dirname(fileURLToPath(metaUrl));
    const schemaPath = join(currentDir, "schema.json");
    if (existsSync(schemaPath)) {
      return schemaPath;
    }
  }

  // For CommonJS (built files)
  if (typeof __dirname !== "undefined") {
    return join(__dirname, "schema.json");
  }

  // For dev mode: try to find the config package
  // Could be in monorepo (packages/config) or installed (node_modules)
  const candidates = [
    // Monorepo from root
    join(process.cwd(), "packages/config/src/schema.json"),
    // Monorepo from a package directory
    join(process.cwd(), "../config/src/schema.json"),
    // Installed package
    join(process.cwd(), "node_modules/@wp-tester/config/dist/schema.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort
  return candidates[candidates.length - 1];
}

/**
 * Get the absolute config file path.
 *
 * @param config - Path to config file (relative or absolute)
 * @returns Absolute path to the config file
 */
export function getConfigPath(config: string): string {
  // Expand tilde (~) to home directory
  if (config.startsWith('~/') || config === '~') {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('Unable to resolve home directory');
    }
    config = config === '~' ? homeDir : join(homeDir, config.slice(2));
  }

  return isAbsolute(config) ? config : resolve(getWorkingDirectory(), config);
}

/**
 * Normalize a config path to ensure it points to a file, not a directory.
 * If the path is a directory, searches for wp-tester.ts, wp-tester.js, or wp-tester.json
 * (in that order) and returns the first one found.
 * Used by readConfigFile, resolveConfig, and the test watcher to handle
 * directory paths passed via --config flag.
 *
 * @param configPath - Path to config file or directory (relative or absolute)
 * @returns Absolute path to the config file
 */
export function normalizeConfigPath(configPath: string): string {
  const absolutePath = getConfigPath(configPath);

  // Check if path is a directory (synchronous)
  try {
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      // Search for config file in priority order
      const foundConfig = findConfigFile(absolutePath);
      return foundConfig || join(absolutePath, 'wp-tester.json');
    }
  } catch {
    // If stat fails, assume it's a file path
  }

  return absolutePath;
}

/**
 * Get the config file directory path.
 *
 * @param configPath - Path to config file
 * @returns Directory path where the config file is located
 */
export function getConfigDir(configPath: string): string {
  return dirname(normalizeConfigPath(configPath));
}

/**
 * Get the project root directory path.
 *
 * Returns config.projectHostPath if specified (resolved relative to config file or as absolute),
 * otherwise returns the config file's directory.
 *
 * @param config - Config object
 * @param configPath - Optional path to config file (needed to resolve relative projectHostPath)
 * @returns Absolute path to the project root directory
 */
export function getProjectDir(
  config: WPTesterConfig,
  configPath?: string
): string {
  // Get base directory: config file location or cwd
  const baseDir = configPath ? getConfigDir(configPath) : getWorkingDirectory();

  // If projectHostPath is specified, resolve it relative to base directory
  if (config.projectHostPath) {
    return resolveAbsolute(config.projectHostPath, baseDir);
  }

  // No projectHostPath specified, return base directory
  return baseDir;
}

/**
 * Convert a host path to a ResolvedPath using the project path mapping
 * @param hostPath - Absolute path on host
 * @param projectPath - Project path mapping
 * @returns ResolvedPath with both host and VFS paths
 */
export function toResolvedPath(hostPath: string, projectPath: ResolvedPath): ResolvedPath {
  return {
    hostPath,
    vfsPath: hostToVfs(hostPath, projectPath),
  };
}
