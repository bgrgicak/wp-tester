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
 * Prompt user to select PHPUnit test mode
 * @returns Selected test mode ("unit" or "integration"), or null if cancelled
 */
async function promptForTestMode(): Promise<"unit" | "integration" | null> {
  const testModeAnswer = await clack.select({
    message: "What type of PHPUnit tests will you run?",
    options: [
      {
        value: "unit",
        label: "Unit tests",
        hint: "Uses WP Test library mocks - won't break existing tests"
      },
      {
        value: "integration",
        label: "Integration tests",
        hint: "Runs inside WordPress - call WP functions, test plugin compatibility, make HTTP requests"
      }
    ],
    initialValue: "unit"
  });

  if (clack.isCancel(testModeAnswer)) {
    return null;
  }

  return testModeAnswer as "unit" | "integration";
}

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
  projectHostPath: string
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
    const exists = await validatePath(projectHostPath, trimmed);
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
    const exists = await validatePath(projectHostPath, trimmed);
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

    const exists = await validatePath(projectHostPath, trimmed);
    if (exists) {
      bootstrapPath = trimmed;
      break;
    }
    clack.log.error(
      `File not found: ${trimmed}. Leave empty to skip or provide a valid path.`
    );
  }

  // Prompt for test mode
  const testMode = await promptForTestMode();
  if (testMode === null) {
    return null;
  }

  const result: PHPUnitConfig = {
    phpunitPath,
    configPath,
    testMode: testMode,
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
  projectHostPath: string,
  configFile: string,
  executable: string,
  bootstrap: string | null
): Promise<WPTesterConfig> {
  // Convert to relative paths
  const relativeConfig = relative(projectHostPath, configFile);
  const relativeExecutable = relative(projectHostPath, executable);
  const relativeBootstrap = bootstrap ? relative(projectHostPath, bootstrap) : null;

  // Display detected configuration
  const configNote =
    `PHPUnit executable: ${relativeExecutable}\n` +
    `Config file: ${relativeConfig}` +
    (relativeBootstrap ? `\nBootstrap file: ${relativeBootstrap}` : "");

  clack.note(configNote, "Detected PHPUnit Configuration");

  // Ask user to confirm or customize
  const action = await clack.select({
    message: "PHPUnit configuration detected. What would you like to do?",
    options: [
      { value: "use", label: "Use detected configuration", hint: "Recommended" },
      { value: "customize", label: "Customize configuration", hint: "Specify different paths" },
      { value: "skip", label: "Skip PHPUnit tests", hint: "Configure later" },
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
    const customConfig = await collectManualPHPUnitConfig(config, projectHostPath);
    if (!customConfig) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }
    finalConfig = customConfig;
  } else {
    // Prompt for test mode even when using detected config
    const testMode = await promptForTestMode();
    if (testMode === null) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    finalConfig = {
      phpunitPath: relativeExecutable,
      configPath: relativeConfig,
      testMode: testMode,
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
  projectHostPath: string,
  configFile: string
): Promise<WPTesterConfig> {
  const relativeConfig = relative(projectHostPath, configFile);

  while (true) {
    const message =
      `Found ${relativeConfig} but PHPUnit executable not found at vendor/bin/phpunit.\n` +
      `You may need to run 'composer install' first.`;

    clack.note(message, "Partial PHPUnit Detection");

    const action = await clack.select({
      message: "What would you like to do?",
      options: [
        { value: "retry", label: "Try again", hint: "After running composer install" },
        { value: "custom", label: "Specify custom path", hint: "PHPUnit is in a different location" },
        { value: "skip", label: "Skip for now", hint: "Configure later" },
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
        projectHostPath
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
    const executable = await findPhpUnitExecutable(projectHostPath);
    if (executable) {
      // Success! Now we have both config and executable
      const bootstrap = await findPhpUnitBootstrap(projectHostPath, configFile);
      return handleFullDetection(
        config,
        projectHostPath,
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
  projectHostPath: string,
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

  const manualConfig = await collectManualPHPUnitConfig(config, projectHostPath);
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
  const projectHostPath = getProjectDir(config, configPath);

  // Run individual detections for granular feedback
  const configFile = await findPhpUnitConfig(projectHostPath);
  const executable = await findPhpUnitExecutable(projectHostPath);

  // Handle different detection states
  if (configFile && executable) {
    // Full detection - both found
    const bootstrap = await findPhpUnitBootstrap(projectHostPath, configFile);
    return handleFullDetection(config, projectHostPath, configFile, executable, bootstrap);
  } else if (configFile && !executable) {
    // Partial detection - config found but executable missing
    return handlePartialDetection(config, projectHostPath, configFile);
  } else {
    // No detection - neither found (or unusual case: executable but no config)
    return handleNoDetection(config, projectHostPath, promptIfNotDetected);
  }
}
