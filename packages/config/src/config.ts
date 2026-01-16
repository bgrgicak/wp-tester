import type { WPTesterConfig, Tests, Environment } from "./wp-tester-config";
import type { ResolvedWPTesterConfig, ResolvedEnvironment, ResolvedTests, ResolvedPHPUnitConfig, ResolvedBlueprint, ResolvedReporters } from "./resolved-types";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { existsSync, statSync } from "fs";
import { join, dirname, resolve, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { getProjectRootMount } from "./auto-mount";
import { detectProjectType } from "./options/project-type-detect";

/**
 * Internal interface for expanded environments with resolved version arrays.
 * This is used internally during expansion before full resolution.
 */
interface ExpandedEnvironment extends Environment {
  /** The specific PHP version for this expanded environment */
  _phpVersion?: string;
  /** The specific WP version for this expanded environment */
  _wpVersion?: string;
}

export type { WPTesterConfig } from "./wp-tester-config";

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

export function configPath(): string {
  return join(getWorkingDirectory(), "wp-tester.json");
}

export function getSchemaPath(importMetaUrl?: string): string {
  // For ESM in production (built files)
  if (importMetaUrl) {
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    return join(currentDir, "schema.json");
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

export async function readConfigFile(path?: string): Promise<WPTesterConfig> {
  if (!path) {
    path = configPath();
  }

  // Normalize the path (handles directory paths)
  path = normalizeConfigPath(path);

  const content = await readFile(path, "utf8");
  return JSON.parse(content) as WPTesterConfig;
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
 * If the path is a directory, appends 'wp-tester.json' to it.
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
      return join(absolutePath, 'wp-tester.json');
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
  return dirname(getConfigPath(configPath));
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
 * Normalize a version spec (string or array) to an array of versions.
 * @param spec - Version specification (single string or array)
 * @returns Array of version strings
 */
function normalizeVersionSpec(spec: string | string[] | undefined): string[] {
  if (!spec) {
    return [];
  }
  return Array.isArray(spec) ? spec : [spec];
}

/**
 * Generate a name for an expanded environment based on the original name
 * and the specific PHP/WP versions.
 * @param baseName - Original environment name (if any)
 * @param phpVersion - PHP version for this combination (only if from matrix)
 * @param wpVersion - WordPress version for this combination (only if from matrix)
 * @param phpIsFromMatrix - Whether PHP version is from matrix expansion (not blueprint)
 * @param wpIsFromMatrix - Whether WP version is from matrix expansion (not blueprint)
 * @param isMatrix - Whether this is part of a matrix (multiple combinations)
 * @returns Generated environment name
 */
function generateExpandedName(
  baseName: string | undefined,
  phpVersion: string | undefined,
  wpVersion: string | undefined,
  phpIsFromMatrix: boolean,
  wpIsFromMatrix: boolean,
  isMatrix: boolean
): string | undefined {
  // If not a matrix expansion, keep the original name
  if (!isMatrix) {
    return baseName;
  }

  // Build version suffix - only include versions that are from the matrix
  const parts: string[] = [];
  if (phpVersion && phpIsFromMatrix) {
    parts.push(`PHP ${phpVersion}`);
  }
  if (wpVersion && wpIsFromMatrix) {
    parts.push(`WP ${wpVersion}`);
  }

  if (parts.length === 0) {
    return baseName;
  }

  const versionSuffix = parts.join(", ");
  return baseName ? `${baseName} (${versionSuffix})` : versionSuffix;
}

/**
 * Expand environments with version arrays into multiple environments,
 * one for each combination of PHP and WP versions.
 *
 * Rules:
 * - If blueprint.preferredVersions.php is set, it overrides env.php (no matrix for PHP)
 * - If blueprint.preferredVersions.wp is set, it overrides env.wp (no matrix for WP)
 * - When arrays are provided for both php and wp, creates a full matrix of combinations
 *
 * @param environments - Original environments array
 * @param projectDir - Project directory for resolving blueprint paths
 * @returns Expanded environments array
 */
async function expandEnvironments(
  environments: Environment[],
  projectDir: string
): Promise<ExpandedEnvironment[]> {
  const expanded: ExpandedEnvironment[] = [];

  for (const env of environments) {
    // Load blueprint if it's a string path (needed to check preferredVersions)
    // If no blueprint is provided, use an empty object (defaults will be applied later)
    let blueprint: BlueprintV1Declaration;
    if (!env.blueprint) {
      blueprint = {};
    } else if (typeof env.blueprint === "string") {
      const blueprintPath = resolveAbsolute(env.blueprint, projectDir);
      const blueprintContent = await readFile(blueprintPath, "utf-8");
      blueprint = JSON.parse(blueprintContent) as BlueprintV1Declaration;
    } else {
      blueprint = env.blueprint;
    }

    // Determine PHP versions to use
    // Blueprint preferredVersions.php overrides environment-level php
    // However, "latest" is treated as unspecified, allowing matrix expansion
    const blueprintPhp = blueprint.preferredVersions?.php;
    let phpVersions: string[];
    let phpIsFromMatrix: boolean;
    if (blueprintPhp && blueprintPhp !== "latest") {
      // Blueprint takes precedence - use only the blueprint version
      phpVersions = [blueprintPhp];
      phpIsFromMatrix = false; // Not from matrix, from blueprint
    } else {
      // Use environment-level versions
      phpVersions = normalizeVersionSpec(env.php);
      phpIsFromMatrix = true; // From matrix (env-level config)
    }

    // Determine WP versions to use
    // Blueprint preferredVersions.wp overrides environment-level wp
    // However, "latest" is treated as unspecified, allowing matrix expansion
    const blueprintWp = blueprint.preferredVersions?.wp;
    let wpVersions: string[];
    let wpIsFromMatrix: boolean;
    if (blueprintWp && blueprintWp !== "latest") {
      // Blueprint takes precedence - use only the blueprint version
      wpVersions = [blueprintWp];
      wpIsFromMatrix = false; // Not from matrix, from blueprint
    } else {
      // Use environment-level versions
      wpVersions = normalizeVersionSpec(env.wp);
      wpIsFromMatrix = true; // From matrix (env-level config)
    }

    // If no versions specified at either level, create a single environment
    if (phpVersions.length === 0 && wpVersions.length === 0) {
      expanded.push({ ...env });
      continue;
    }

    // Ensure at least one version for each dimension (use empty string as placeholder for "not specified")
    const phpList = phpVersions.length > 0 ? phpVersions : [""];
    const wpList = wpVersions.length > 0 ? wpVersions : [""];

    // Determine if this is a matrix (multiple combinations)
    const isMatrix = phpList.length > 1 || wpList.length > 1;

    // Create combinations
    for (const phpVersion of phpList) {
      for (const wpVersion of wpList) {
        const expandedEnv: ExpandedEnvironment = {
          ...env,
          name: generateExpandedName(
            env.name,
            phpVersion || undefined,
            wpVersion || undefined,
            phpIsFromMatrix,
            wpIsFromMatrix,
            isMatrix
          ),
          _phpVersion: phpVersion || undefined,
          _wpVersion: wpVersion || undefined,
        };
        expanded.push(expandedEnv);
      }
    }
  }

  return expanded;
}

/**
 * Resolve PHPUnit config paths and set default testMode
 * @param tests - Tests configuration
 * @param projectDir - Project directory for resolving relative paths
 * @returns Resolved tests configuration
 */
function resolveTests(tests: Tests, projectDir: string): ResolvedTests {
  // If no PHPUnit config, return tests as-is (but explicitly typed)
  if (!tests.phpunit) {
    return {
      plugin: tests.plugin,
      theme: tests.theme,
      wp: tests.wp,
      passWithNoTests: tests.passWithNoTests,
    };
  }

  // Resolve PHPUnit config with absolute paths and default testMode
  const phpunit = tests.phpunit;
  const resolvedPhpunit: ResolvedPHPUnitConfig = {
    phpunitPath: resolveAbsolute(phpunit.phpunitPath, projectDir),
    configPath: resolveAbsolute(phpunit.configPath, projectDir),
    testMode: phpunit.testMode ?? "unit",
  };

  // Add optional bootstrapPath if present
  if (phpunit.bootstrapPath) {
    resolvedPhpunit.bootstrapPath = resolveAbsolute(
      phpunit.bootstrapPath,
      projectDir
    );
  }

  // Preserve phpunitArgs if present
  if (phpunit.phpunitArgs) {
    resolvedPhpunit.phpunitArgs = phpunit.phpunitArgs;
  }

  return {
    plugin: tests.plugin,
    theme: tests.theme,
    wp: tests.wp,
    phpunit: resolvedPhpunit,
    passWithNoTests: tests.passWithNoTests,
  };
}

/**
 * Resolve config from path or object and adjust relative paths to absolute paths
 * @param config - Config file path or config object
 * @returns Config with all paths resolved to absolute paths, blueprints loaded, and all required fields set
 */
export async function resolveConfig(
  config: WPTesterConfig | string
): Promise<ResolvedWPTesterConfig> {
  let resolvedConfig: WPTesterConfig;
  let configPath: string | undefined;

  if (typeof config === "string") {
    // Normalize the path (handles directory paths)
    configPath = normalizeConfigPath(config);

    const content = await readFile(configPath, "utf8");
    resolvedConfig = JSON.parse(content) as WPTesterConfig;
  } else {
    // Config object provided
    resolvedConfig = config;
    configPath = undefined;
  }

  // Get the project root directory (respects projectHostPath config option)
  const projectDir = getProjectDir(resolvedConfig, configPath);

  // Ensure projectType is set (detect if not provided)
  // Skip detection if directory doesn't exist to avoid filesystem errors in tests
  // that intentionally use invalid paths for error handling
  let projectType = resolvedConfig.projectType;
  if (!projectType && existsSync(projectDir)) {
    try {
      projectType = detectProjectType(projectDir);
    } catch {
      // If detection fails (e.g., permission errors), default to 'other'
      projectType = 'other';
    }
  } else if (!projectType) {
    // Directory doesn't exist, default to 'other'
    projectType = 'other';
  }

  // Ensure reporters is set with defaults
  // If no reporters configured, default to showing all test statuses
  const defaultReporterOptions = {
    passed: true,
    failed: true,
    skipped: true,
    pending: true,
    other: true,
  };

  const reporters: ResolvedReporters = {
    ...(resolvedConfig.reporters ?? {}),
    default: undefined, // Will be set below
  };

  // Normalize default reporter:
  // - `true` or empty object `{}` -> apply default options (show all)
  // - `false` -> disable default reporter (remove it)
  // - object with options -> use as-is
  const inputDefault = resolvedConfig.reporters?.default;
  if (inputDefault === true || inputDefault === undefined || (typeof inputDefault === 'object' && Object.keys(inputDefault).length === 0)) {
    // true, undefined, or empty object -> use defaults (show all)
    if (inputDefault !== undefined || !resolvedConfig.reporters?.json) {
      reporters.default = defaultReporterOptions;
    }
  } else if (inputDefault === false) {
    // false -> disable default reporter
    reporters.default = undefined;
  } else {
    // Object with specific options -> use as-is
    reporters.default = inputDefault;
  }

  // Expand environments with version arrays into multiple environments
  const expandedEnvironments = await expandEnvironments(
    resolvedConfig.environments,
    projectDir
  );

  // Resolve environments: convert ExpandedEnvironment[] to ResolvedEnvironment[]
  const resolvedEnvironments: ResolvedEnvironment[] = await Promise.all(
    expandedEnvironments.map(async (env) => {
      // Resolve blueprint from string to BlueprintV1Declaration if needed
      // If no blueprint is provided, use an empty object (defaults will be applied later)
      let blueprint: BlueprintV1Declaration;
      if (!env.blueprint) {
        blueprint = {};
      } else if (typeof env.blueprint === "string") {
        const blueprintPath = resolveAbsolute(env.blueprint, projectDir);
        const blueprintContent = await readFile(blueprintPath, "utf-8");
        blueprint = JSON.parse(blueprintContent) as BlueprintV1Declaration;
      } else {
        blueprint = env.blueprint;
      }

      // Determine PHP version:
      // 1. Use the expanded version from matrix (_phpVersion) if set
      // 2. Otherwise use blueprint preferredVersions.php if set
      // 3. Otherwise default to "latest"
      const phpVersion = env._phpVersion || blueprint.preferredVersions?.php || "latest";

      // Determine WP version:
      // 1. Use the expanded version from matrix (_wpVersion) if set
      // 2. Otherwise use blueprint preferredVersions.wp if set
      // 3. Otherwise default to "latest"
      const wpVersion = env._wpVersion || blueprint.preferredVersions?.wp || "latest";

      // Create resolved blueprint with determined versions
      // Type assertion is needed because the versions come from user config
      // and TypeScript can't verify at compile time that they're valid.
      // Invalid versions will be caught by WordPress Playground at runtime.
      const resolvedBlueprint: ResolvedBlueprint = {
        ...blueprint,
        preferredVersions: {
          php: phpVersion as ResolvedBlueprint['preferredVersions']['php'],
          wp: wpVersion,
        },
      };

      // Auto-detect and add mounts if needed
      let mounts = env.mounts ? [...env.mounts] : []; // Create a copy to avoid mutating original

      // If projectHostPath is specified, always add the project root mount
      // This ensures the project root is accessible even when custom mounts are specified
      // Only create the mount if the directory exists to avoid mount errors with invalid paths
      if (resolvedConfig.projectHostPath && existsSync(projectDir)) {
        const mount = getProjectRootMount(projectDir, projectType);
        if (mount) {
          // Check if this mount already exists (by vfsPath) to avoid duplicates
          // Normalize paths by removing trailing slashes for comparison
          const normalizeVfsPath = (path: string) => path.replace(/\/+$/, '');
          const mountVfsPath = normalizeVfsPath(mount.vfsPath);
          const existingMount = mounts.find(m => normalizeVfsPath(m.vfsPath) === mountVfsPath);
          if (!existingMount) {
            // Prepend auto-mount so custom mounts can override if needed
            mounts = [mount, ...mounts];
          }
        }
      }

      // Resolve relative mount paths to absolute paths
      const resolvedMounts = mounts.map((mount) => ({
        ...mount,
        hostPath: resolveAbsolute(mount.hostPath, projectDir),
      }));

      // Sort mounts by VFS path depth (shallowest first, deepest last).
      // WordPress Playground applies mounts in order, with later mounts taking precedence.
      // By mounting parent paths first and child paths last, child mounts can override
      // parent mounts when paths overlap.
      // Example: /wordpress/wp-content/plugins should come before /wordpress/wp-content/plugins/foo
      resolvedMounts.sort((a, b) => {
        const depthA = a.vfsPath.split('/').filter(Boolean).length;
        const depthB = b.vfsPath.split('/').filter(Boolean).length;
        return depthA - depthB; // Sort ascending (shallowest first)
      });

      return {
        name: env.name,
        blueprint: resolvedBlueprint,
        mounts: resolvedMounts,
        env: env.env || {},
        skip: env.skip ?? false,
      };
    })
  );

  // Resolve PHPUnit paths to absolute paths and ensure testMode has a default
  const resolvedTests: ResolvedTests = resolveTests(
    resolvedConfig.tests,
    projectDir
  );

  // Determine project VFS path
  let projectVFSPath: string;
  if (resolvedConfig.projectVFSPath !== undefined) {
    // Explicitly specified in config
    projectVFSPath = resolvedConfig.projectVFSPath;
  } else {
    // Auto-detect from projectType
    const mount = getProjectRootMount(projectDir, projectType);
    if (mount?.vfsPath) {
      projectVFSPath = mount.vfsPath;
    } else {
      // For "other" project types without explicit projectVFSPath,
      // fall back to projectDir but validate it looks like a path
      if (projectType === "other" && !projectDir.startsWith("/")) {
        throw new Error(
          `Cannot auto-detect mount path for projectType "other". ` +
          `Please specify "projectVFSPath" in your config to indicate where your project directory should be mounted (e.g., "/project", "/wordpress/wp-content/mu-plugins/my-plugin").`
        );
      }
      projectVFSPath = projectDir;
    }
  }

  // Return fully resolved config with all required fields
  return {
    ...resolvedConfig,
    projectHostPath: projectDir,
    projectVFSPath,
    projectType,
    reporters,
    environments: resolvedEnvironments,
    tests: resolvedTests,
  };
}
