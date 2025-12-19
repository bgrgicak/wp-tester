import type { WPTesterConfig } from "./wp-tester-config";
import type { ResolvedWPTesterConfig, ResolvedEnvironment } from "./resolved-types";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, resolve, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { getProjectRootMount } from "./auto-mount";
import { detectProjectType } from "./options/project-type-detect";

export type { WPTesterConfig } from "./wp-tester-config";

export function configPath(): string {
  return join(process.cwd(), "wp-tester.json");
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
    join(process.cwd(), "node_modules/@wp-tester/config/dist/esm/schema.json"),
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
    reporters: ["default"],
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
  return isAbsolute(config) ? config : resolve(process.cwd(), config);
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
 * Returns config.projectRoot if specified (resolved relative to config file or as absolute),
 * otherwise returns the config file's directory.
 *
 * @param config - Config object
 * @param configPath - Optional path to config file (needed to resolve relative projectRoot)
 * @returns Absolute path to the project root directory
 */
export function getProjectDir(config: WPTesterConfig, configPath?: string): string {
  // Get base directory: config file location or cwd
  const baseDir = configPath ? getConfigDir(configPath) : process.cwd();

  // If projectRoot is specified, resolve it relative to base directory
  if (config.projectRoot) {
    return isAbsolute(config.projectRoot) ? config.projectRoot : resolve(baseDir, config.projectRoot);
  }

  // No projectRoot specified, return base directory
  return baseDir;
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
    configPath = getConfigPath(config);
    const content = await readFile(configPath, "utf8");
    resolvedConfig = JSON.parse(content) as WPTesterConfig;
  } else {
    // Config object provided
    resolvedConfig = config;
    configPath = undefined;
  }

  // Get the project root directory (respects projectRoot config option)
  const projectDir = getProjectDir(resolvedConfig, configPath);

  // Ensure projectType is set (detect if not provided)
  const projectType = resolvedConfig.projectType || detectProjectType(projectDir);

  // Ensure reporters is set
  const reporters = resolvedConfig.reporters || ["default"];

  // Resolve environments: convert Environment[] to ResolvedEnvironment[]
  const resolvedEnvironments: ResolvedEnvironment[] = await Promise.all(
    resolvedConfig.environments.map(async (env) => {
      // Resolve blueprint from string to BlueprintV1Declaration if needed
      let blueprint: BlueprintV1Declaration;
      if (typeof env.blueprint === "string") {
        const blueprintPath = isAbsolute(env.blueprint)
          ? env.blueprint
          : resolve(projectDir, env.blueprint);
        const blueprintContent = await readFile(blueprintPath, "utf-8");
        blueprint = JSON.parse(blueprintContent) as BlueprintV1Declaration;
      } else {
        blueprint = env.blueprint;
      }

      // Auto-detect and add mounts if needed
      let mounts = env.mounts || [];
      if (mounts.length === 0 && resolvedConfig.projectRoot) {
        const mount = getProjectRootMount(projectDir, projectType);
        if (mount) {
          mounts = [mount];
        }
      }

      // Resolve relative mount paths to absolute paths
      const resolvedMounts = mounts.map((mount) => ({
        ...mount,
        hostPath: isAbsolute(mount.hostPath)
          ? mount.hostPath
          : resolve(projectDir, mount.hostPath),
      }));

      return {
        name: env.name,
        blueprint,
        mounts: resolvedMounts,
      };
    })
  );

  // Return fully resolved config with all required fields
  return {
    ...resolvedConfig,
    projectRoot: projectDir,
    projectType,
    reporters,
    environments: resolvedEnvironments,
  };
}
