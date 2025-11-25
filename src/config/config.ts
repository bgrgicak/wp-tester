import type { ConfigOption, WPTesterConfig } from "./types";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

export function configPath(): string {
  return path.join(process.cwd(), "wp-tester.json");
}

export async function isConfigWritable(): Promise<boolean> {
  try {
    await fs.access(configPath(), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function updateConfigOption(
  config: Partial<WPTesterConfig>,
  option: ConfigOption,
  userChoice: boolean | string | string[]
): Partial<WPTesterConfig> {
  if (option.apply) {
    return option.apply(config, userChoice);
  }

  // Default apply: convert to appropriate type
  let typedValue: unknown;
  switch (option.type) {
    case "confirm":
      typedValue = Boolean(userChoice);
      break;
    case "text":
    case "select":
      typedValue = String(userChoice);
      break;
    case "multiselect":
      if (!Array.isArray(userChoice)) {
        throw new Error(
          `Expected array for multiselect option "${option.key}"`
        );
      }
      typedValue = userChoice.map(String);
      break;
    default:
      throw new Error(`Unknown option type "${option.type}"`);
  }

  return {
    ...config,
    [option.key]: typedValue,
  };
}

export async function writeConfigFile(
  config: Partial<WPTesterConfig>
): Promise<void> {
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}
