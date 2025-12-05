import type { WPTesterConfig } from "./types";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export type { WPTesterConfig } from "./types";

export function configPath(): string {
  return join(process.cwd(), "wp-tester.json");
}

export function getSchemaPath(importMetaUrl?: string): string {
  // For ESM in production (built files)
  if (importMetaUrl) {
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    return join(currentDir, 'schema.json');
  }

  // For CommonJS (built files)
  if (typeof __dirname !== 'undefined') {
    return join(__dirname, 'schema.json');
  }

  // For dev mode: try to find the config package
  // Could be in monorepo (packages/config) or installed (node_modules)
  const candidates = [
    // Monorepo from root
    join(process.cwd(), 'packages/config/src/schema.json'),
    // Monorepo from a package directory
    join(process.cwd(), '../config/src/schema.json'),
    // Installed package
    join(process.cwd(), 'node_modules/@wp-tester/config/dist/esm/schema.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort
  return candidates[candidates.length - 1];
}

export function getDefaultConfig(): Partial<WPTesterConfig> {
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

export async function readConfigFile(): Promise<Partial<WPTesterConfig>> {
  const content = await readFile(configPath(), "utf8");
  return JSON.parse(content);
}

export async function writeConfigFile(
  config: Partial<WPTesterConfig>
): Promise<void> {
  await writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}
