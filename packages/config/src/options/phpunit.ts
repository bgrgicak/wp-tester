import { detectPhpUnit } from "./phpunit-detect";
import type { WPTesterConfig } from "../types";
import * as clack from "@clack/prompts";

/**
 * PHPUnit config option
 * Detects PHPUnit tests and asks user if they want to run them
 */
export async function phpunitOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  // Run detection from phpunit package
  const isDetected = await detectPhpUnit();

  // If not detected, return config unchanged
  if (!isDetected) {
    return config;
  }

  // Prompt user
  const runPhpUnit = await clack.confirm({
    message: "PHPUnit tests detected. Do you want to run them with WP-Tester?",
    initialValue: true,
  });

  // Handle cancel
  if (clack.isCancel(runPhpUnit)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  // Return config with phpunit flag if confirmed
  if (runPhpUnit) {
    return {
      ...config,
      tests: {
        ...config.tests,
        phpunit: true,
      },
    };
  }

  return config;
}
