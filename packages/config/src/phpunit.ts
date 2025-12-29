import type { WPTesterConfig } from "./wp-tester-config";
import { readConfigFile, getConfigDir } from "./config";

/**
 * Merge additional PHPUnit arguments into a config object.
 * Creates a new config object with merged phpunitArgs and preserves the config path context
 * by setting projectHostPath to the config directory if not already set.
 *
 * @param config - Config object or path to config file
 * @param additionalArgs - Additional PHPUnit arguments to append
 * @returns Config object with merged phpunitArgs
 */
export async function mergePhpunitArgs(
  config: WPTesterConfig | string,
  additionalArgs: string[]
): Promise<WPTesterConfig> {
  // Track the config path for proper resolution
  const configPath = typeof config === "string" ? config : undefined;

  // Load config if path is provided
  const loadedConfig = typeof config === "string"
    ? await readConfigFile(config)
    : config;

  // If no additional args, return config as-is (but with projectHostPath set if needed)
  if (!additionalArgs || additionalArgs.length === 0) {
    // If config was loaded from a file path and projectHostPath is not set,
    // set it to the config directory to preserve path context
    if (configPath && !loadedConfig.projectHostPath) {
      return {
        ...loadedConfig,
        projectHostPath: getConfigDir(configPath),
      };
    }
    return loadedConfig;
  }

  // Merge args (config args first, then additional args)
  const configArgs = loadedConfig.tests?.phpunit?.phpunitArgs || [];
  const mergedArgs = [...configArgs, ...additionalArgs];

  // Create new config with merged args
  // If config was loaded from a file path and projectHostPath is not set,
  // set it to the config directory to preserve path context
  const result: WPTesterConfig = {
    ...loadedConfig,
    tests: {
      ...loadedConfig.tests,
      phpunit: loadedConfig.tests?.phpunit ? {
        ...loadedConfig.tests.phpunit,
        phpunitArgs: mergedArgs,
      } : undefined,
    },
  };

  // Preserve the config path context
  if (configPath && !result.projectHostPath) {
    result.projectHostPath = getConfigDir(configPath);
  }

  return result;
}
