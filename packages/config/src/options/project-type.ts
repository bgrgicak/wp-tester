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
  const message = detectedType === 'other'
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
        { value: 'plugin', label: 'Plugin' },
        { value: 'theme', label: 'Theme' },
        { value: 'other', label: 'Other' },
      ],
    });

    // Handle cancel
    if (clack.isCancel(selectedType)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    finalType = selectedType as ProjectType;
  }

  // If project type is "other", prompt for VFS path
  let projectVFSPath: string | undefined = config.projectVFSPath;
  if (finalType === 'other') {
    const vfsPath = await clack.text({
      message: "Where should your project directory be mounted?",
      placeholder: "/wordpress",
      validate: (value) => {
        if (!value || value.trim() === '') {
          return 'Mount path is required for "other" project type';
        }
        if (!value.startsWith('/')) {
          return 'Mount path must start with "/" (e.g., "/wordpress", "/wordpress/wp-content/mu-plugins/my-plugin")';
        }
        return undefined;
      },
    });

    // Handle cancel
    if (clack.isCancel(vfsPath)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    projectVFSPath = vfsPath;
  }

  // Return config with project type and VFS path
  return {
    ...config,
    projectType: finalType,
    ...(projectVFSPath && { projectVFSPath }),
  };
}
