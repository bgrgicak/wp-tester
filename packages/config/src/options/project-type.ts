import type { WPTesterConfig } from "../types";
import * as clack from "@clack/prompts";
import { getProjectDir } from "../config";
import { detectProjectType, type ProjectType } from "./project-type-detect";

/**
 * Project type detection option
 * Detects WordPress project type and asks user to confirm
 */
export async function projectTypeOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  // Get the project root directory using the config helper
  const projectHostPath = getProjectDir(config);

  // Detect project type
  const detectedType = detectProjectType(projectHostPath);

  // Ask for confirmation with the detected type in the question
  const message = detectedType === 'unknown'
    ? "We couldn't detect your project type. Continue with setup anyway?"
    : `Is this project a ${detectedType}?`;

  const isCorrect = await clack.confirm({
    message,
    initialValue: true,
  });

  // Handle cancel
  if (clack.isCancel(isCorrect)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  let finalType: ProjectType = detectedType;

  // If not correct, show selection menu
  if (!isCorrect) {
    const selectedType = await clack.select({
      message: "Select project type:",
      options: [
        { value: 'plugin', label: 'plugin' },
        { value: 'theme', label: 'theme' },
        { value: 'unknown', label: 'other' },
      ],
    });

    // Handle cancel
    if (clack.isCancel(selectedType)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    finalType = selectedType as ProjectType;
  }

  // Return config with project type
  return {
    ...config,
    projectType: finalType,
  };
}
