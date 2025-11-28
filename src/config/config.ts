import type { WPTesterConfig } from "./types";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

export function configPath(): string {
  return path.join(process.cwd(), "wp-tester.json");
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
    await fs.access(configPath(), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readConfigFile(): Promise<Partial<WPTesterConfig>> {
  const content = await fs.readFile(configPath(), "utf8");
  return JSON.parse(content);
}

export async function writeConfigFile(
  config: Partial<WPTesterConfig>
): Promise<void> {
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}
