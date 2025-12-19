import type { WPTesterConfig, PHPUnitConfig } from "../types";
import * as clack from "@clack/prompts";
import { getProjectDir } from "../config";
import {
  findPhpUnitConfig,
  findPhpUnitExecutable,
  findPhpUnitBootstrap,
} from "./phpunit-detect";
import { access } from "fs/promises";
import { join, relative } from "path";

/**
 * Validate that a file path exists
 */
async function validatePath(basePath: string, relativePath: string): Promise<boolean> {
  try {
    const fullPath = join(basePath, relativePath);
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Collect manual PHPUnit configuration from user input with validation
 */
async function collectManualPHPUnitConfig(
  config: WPTesterConfig,
  projectRoot: string
): Promise<PHPUnitConfig | null> {
  // Get PHPUnit executable path with validation
  let phpunitPath: string;
  while (true) {
    const input = await clack.text({
      message: "Path to PHPUnit executable (relative to project root):",
      initialValue: config.tests?.phpunit?.phpunitPath || "vendor/bin/phpunit",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "PHPUnit path is required";
        }
      },
    });

    if (clack.isCancel(input)) {
      return null;
    }

    const trimmed = input.trim();
    const exists = await validatePath(projectRoot, trimmed);
    if (exists) {
      phpunitPath = trimmed;
      break;
    }
    clack.log.error(`File not found: ${trimmed}`);
  }

  // Get PHPUnit config file path with validation
  let configPath: string;
  while (true) {
    const input = await clack.text({
      message: "Path to PHPUnit config file (relative to project root):",
      initialValue: config.tests?.phpunit?.configPath || "phpunit.xml.dist",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "Config path is required";
        }
      },
    });

    if (clack.isCancel(input)) {
      return null;
    }

    const trimmed = input.trim();
    const exists = await validatePath(projectRoot, trimmed);
    if (exists) {
      configPath = trimmed;
      break;
    }
    clack.log.error(`File not found: ${trimmed}`);
  }

  // Get optional bootstrap path
  let bootstrapPath: string | undefined;
  while (true) {
    const input = await clack.text({
      message:
        "Path to PHPUnit bootstrap file (optional, relative to project root):",
      initialValue: config.tests?.phpunit?.bootstrapPath || "",
      placeholder: "tests/bootstrap.php (leave empty to skip)",
    });

    if (clack.isCancel(input)) {
      return null;
    }

    // Safely handle undefined/non-string input for optional field
    const trimmed = input && typeof input === "string" ? input.trim() : "";
    if (!trimmed) {
      // Empty is okay for optional field
      break;
    }

    const exists = await validatePath(projectRoot, trimmed);
    if (exists) {
      bootstrapPath = trimmed;
      break;
    }
    clack.log.error(
      `File not found: ${trimmed}. Leave empty to skip or provide a valid path.`
    );
  }

  const result: PHPUnitConfig = {
    phpunitPath,
    configPath,
  };

  // Only add bootstrapPath if provided
  if (bootstrapPath) {
    result.bootstrapPath = bootstrapPath;
  }

  return result;
}

/**
 * Handle full detection (both config and executable found)
 */
async function handleFullDetection(
  config: WPTesterConfig,
  projectRoot: string,
  configFile: string,
  executable: string,
  bootstrap: string | null
): Promise<WPTesterConfig> {
  // Convert to relative paths
  const relativeConfig = relative(projectRoot, configFile);
  const relativeExecutable = relative(projectRoot, executable);
  const relativeBootstrap = bootstrap ? relative(projectRoot, bootstrap) : null;

  // Display detected configuration
  const configNote =
    `PHPUnit executable: ${relativeExecutable}\n` +
    `Config file: ${relativeConfig}` +
    (relativeBootstrap ? `\nBootstrap file: ${relativeBootstrap}` : "");

  clack.note(configNote, "Detected PHPUnit Configuration");

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
    const customConfig = await collectManualPHPUnitConfig(config, projectRoot);
    if (!customConfig) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }
    finalConfig = customConfig;
  } else {
    finalConfig = {
      phpunitPath: relativeExecutable,
      configPath: relativeConfig,
      ...(relativeBootstrap && { bootstrapPath: relativeBootstrap }),
    };
  }

  return {
    ...config,
    tests: {
      ...config.tests,
      phpunit: finalConfig,
    },
  };
}

/**
 * Handle partial detection (config found but executable missing)
 */
async function handlePartialDetection(
  config: WPTesterConfig,
  projectRoot: string,
  configFile: string
): Promise<WPTesterConfig> {
  const relativeConfig = relative(projectRoot, configFile);

  while (true) {
    const message =
      `Found ${relativeConfig} but PHPUnit executable not found at vendor/bin/phpunit.\n` +
      `You may need to run 'composer install' first.`;

    clack.note(message, "Partial PHPUnit Detection");

    const action = await clack.select({
      message: "What would you like to do?",
      options: [
        { value: "retry", label: "I've installed it, try again" },
        { value: "custom", label: "Specify custom path" },
        { value: "skip", label: "Skip for now" },
      ],
      initialValue: "retry",
    });

    if (clack.isCancel(action)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (action === "skip") {
      return config;
    }

    if (action === "custom") {
      const customConfig = await collectManualPHPUnitConfig(
        config,
        projectRoot
      );
      if (!customConfig) {
        clack.cancel("Setup cancelled.");
        process.exit(0);
      }
      return {
        ...config,
        tests: {
          ...config.tests,
          phpunit: customConfig,
        },
      };
    }

    // action === "retry" - re-run detection
    const executable = await findPhpUnitExecutable(projectRoot);
    if (executable) {
      // Success! Now we have both config and executable
      const bootstrap = await findPhpUnitBootstrap(projectRoot);
      return handleFullDetection(
        config,
        projectRoot,
        configFile,
        executable,
        bootstrap
      );
    }

    // Still not found, loop will continue
    clack.log.error(
      "PHPUnit executable still not found. Please install PHPUnit or specify a custom path."
    );
  }
}

/**
 * Handle no detection (neither config nor executable found)
 */
async function handleNoDetection(
  config: WPTesterConfig,
  projectRoot: string,
  promptIfNotDetected: boolean
): Promise<WPTesterConfig> {
  if (!promptIfNotDetected) {
    // Skip silently during initial setup
    return config;
  }

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

  const manualConfig = await collectManualPHPUnitConfig(config, projectRoot);
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

/**
 * PHPUnit config option
 * Detects PHPUnit tests and asks user if they want to run them
 * @param config - Current configuration
 * @param context - Optional context object with configPath and other options
 */
export async function phpunitOption(
  config: WPTesterConfig,
  context?: { configPath?: string; promptIfNotDetected?: boolean }
): Promise<WPTesterConfig> {
  const promptIfNotDetected = context?.promptIfNotDetected ?? false;
  const configPath = context?.configPath;

  // Get the project root directory using the config helper
  const projectRoot = getProjectDir(config, configPath);

  // Run individual detections for granular feedback
  const configFile = await findPhpUnitConfig(projectRoot);
  const executable = await findPhpUnitExecutable(projectRoot);

  // Handle different detection states
  if (configFile && executable) {
    // Full detection - both found
    const bootstrap = await findPhpUnitBootstrap(projectRoot);
    return handleFullDetection(config, projectRoot, configFile, executable, bootstrap);
  } else if (configFile && !executable) {
    // Partial detection - config found but executable missing
    return handlePartialDetection(config, projectRoot, configFile);
  } else {
    // No detection - neither found (or unusual case: executable but no config)
    return handleNoDetection(config, projectRoot, promptIfNotDetected);
  }
}
