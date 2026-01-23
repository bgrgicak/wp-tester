import type { WPTesterConfig } from "./wp-tester-config";
import { readFile, writeFile, access, constants as fsConstants } from "fs/promises";
import { configPath, normalizeConfigPath } from "./path-utils";

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
