import type { WPTesterConfig, PHPUnitConfig } from "../types";
import * as clack from "@clack/prompts";
import { getProjectDir } from "../config";
import { detectPhpUnitConfig } from "./phpunit-detect";

/**
 * Collect manual PHPUnit configuration from user input
 */
async function collectManualPHPUnitConfig(
  config: WPTesterConfig
): Promise<PHPUnitConfig | null> {
  const phpunitPath = await clack.text({
    message: "Path to PHPUnit executable (relative to project root):",
    initialValue: config.tests?.phpunit?.phpunitPath,
    validate: (value) => {
      if (!value || value.trim() === "") {
        return "PHPUnit path is required";
      }
    },
  });

  if (clack.isCancel(phpunitPath)) {
    return null;
  }

  const configPath = await clack.text({
    message: "Path to PHPUnit config file (relative to project root):",
    initialValue: config.tests?.phpunit?.configPath,
    validate: (value) => {
      if (!value || value.trim() === "") {
        return "Config path is required";
      }
    },
  });

  if (clack.isCancel(configPath)) {
    return null;
  }

  const bootstrapPath = await clack.text({
    message: "Path to PHPUnit bootstrap file (relative to project root):",
    initialValue: config.tests?.phpunit?.bootstrapPath,
    validate: (value) => {
      if (!value || value.trim() === "") {
        return "Bootstrap path is required";
      }
    },
  });

  if (clack.isCancel(bootstrapPath)) {
    return null;
  }

  return {
    phpunitPath: phpunitPath as string,
    configPath: configPath as string,
    bootstrapPath: bootstrapPath as string,
  };
}

/**
 * PHPUnit config option
 * Detects PHPUnit tests and asks user if they want to run them
 */
export async function phpunitOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  // Get the project root directory using the config helper
  const projectRoot = getProjectDir(config);

  // Run detection using the unified detection function
  const detectedConfig = await detectPhpUnitConfig(projectRoot);

  // If not detected, offer manual configuration
  if (!detectedConfig) {
    const configureManually = await clack.confirm({
      message: "PHPUnit not detected. Would you like to configure it manually?",
      initialValue: false,
    });

    if (clack.isCancel(configureManually)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (!configureManually) {
      return config;
    }

    const manualConfig = await collectManualPHPUnitConfig(config);
    if (!manualConfig) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    return {
      ...config,
      tests: {
        ...config.tests,
        phpunit: manualConfig,
      },
    };
  }

  // Display detected configuration
  clack.note(
    `PHPUnit executable: ${detectedConfig.phpunitPath}\n` +
      `Config file: ${detectedConfig.configPath}\n` +
      `Bootstrap file: ${detectedConfig.bootstrapPath}`,
    "Detected PHPUnit Configuration"
  );

  // Ask user to confirm or customize
  const action = await clack.select({
    message: "PHPUnit tests detected. What would you like to do?",
    options: [
      { value: "use", label: "Use detected configuration" },
      { value: "customize", label: "Customize configuration" },
      { value: "skip", label: "Skip PHPUnit tests" },
    ],
    initialValue: "use",
  });

  if (clack.isCancel(action)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (action === "skip") {
    return config;
  }

  let finalConfig: PHPUnitConfig;

  if (action === "customize") {
    const customConfig = await collectManualPHPUnitConfig(config);
    if (!customConfig) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }
    finalConfig = customConfig;
  } else {
    finalConfig = detectedConfig;
  }

  return {
    ...config,
    tests: {
      ...config.tests,
      phpunit: finalConfig,
    },
  };
}
