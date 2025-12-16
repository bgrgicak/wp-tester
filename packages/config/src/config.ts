import type { WPTesterConfig } from "./types";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, resolve, isAbsolute } from "path";
import { fileURLToPath } from "url";

export type { WPTesterConfig } from "./types";

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
 * Resolve config from path or object and adjust relative paths to absolute paths
 * @param config - Config file path or config object
 * @param baseDir - Base directory for resolving relative paths when config is an object (defaults to cwd)
 * @returns Config with all paths resolved to absolute paths
 */
export async function resolveConfig(
  config: WPTesterConfig | string
): Promise<WPTesterConfig> {
  let resolvedConfig: WPTesterConfig;
  let configDir: string;

  if (typeof config === "string") {
    const configPath = isAbsolute(config)
      ? config
      : resolve(process.cwd(), config);
    configDir = dirname(configPath);
    const content = await readFile(configPath, "utf8");
    resolvedConfig = JSON.parse(content) as WPTesterConfig;
  } else {
    // Config object provided
    resolvedConfig = config;
    configDir = process.cwd();
  }
  // Resolve relative mount paths to absolute paths
  for (const env of resolvedConfig.environments) {
    if (env.mounts) {
      for (const mount of env.mounts) {
        if (!isAbsolute(mount.hostPath)) {
          mount.hostPath = resolve(configDir, mount.hostPath);
        }
      }
    }
  }
  // Resolve Blueprints from relative paths to absolute paths if needed
  for (const env of resolvedConfig.environments) {
    if (typeof env.blueprint === "string") {
      const blueprintPath = isAbsolute(env.blueprint)
        ? env.blueprint
        : resolve(configDir, env.blueprint);
      env.blueprint = blueprintPath;
    }
  }

  return resolvedConfig;
}
