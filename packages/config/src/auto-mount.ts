// TODO: Replace with import from @wp-playground/cli/mounts
// once that package exports the /mounts subpath with runtime code.
// These functions are based on:
// https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/cli/src/mounts.ts

import { basename } from "path";
import { type ProjectType } from "./options/project-type-detect";
import type { Mount } from "./types";

/**
 * Get the mount point path for a project based on its type
 *
 * @param projectDir - Absolute path to the project directory
 * @param projectType - The project type
 * @returns Mount configuration or null if type doesn't require mounting
 */
export function getProjectRootMount(
  projectDir: string,
  projectType: ProjectType
): Mount | null {
  const dirName = basename(projectDir);

  switch (projectType) {
    case "plugin":
      return {
        hostPath: projectDir,
        vfsPath: `/wordpress/wp-content/plugins/${dirName}`,
      };
    case "theme":
      return {
        hostPath: projectDir,
        vfsPath: `/wordpress/wp-content/themes/${dirName}`,
      };
    case "wp-content":
      return {
        hostPath: projectDir,
        vfsPath: "/wordpress/wp-content",
      };
    case "wordpress":
      return {
        hostPath: projectDir,
        vfsPath: "/wordpress",
      };
    default:
      return null;
  }
}
