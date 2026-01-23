import { relative, join } from "path";
import type { ResolvedPath } from "./resolved-types";

/**
 * Maps a host filesystem path to its corresponding VFS path in the playground
 *
 * @param hostPath - Absolute path on the host filesystem
 * @param projectPath - Resolved path with host and VFS mappings
 * @returns Corresponding VFS path in the playground
 *
 * @example
 * hostToVfs('/project/tests/bootstrap.php', resolvedPath)
 * // Returns: '/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php'
 */
export function hostToVfs(hostPath: string, projectPath: ResolvedPath): string {
  const relativePath = relative(projectPath.hostPath, hostPath);
  return join(projectPath.vfsPath, relativePath);
}

/**
 * Maps a VFS path in the playground to its corresponding host filesystem path
 *
 * @param vfsPath - Path in the playground VFS
 * @param projectPath - Resolved path with host and VFS mappings
 * @returns Corresponding absolute path on the host filesystem
 *
 * @example
 * vfsToHost('/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php', resolvedPath)
 * // Returns: '/project/tests/bootstrap.php'
 */
export function vfsToHost(vfsPath: string, projectPath: ResolvedPath): string {
  const relativePath = relative(projectPath.vfsPath, vfsPath);
  return join(projectPath.hostPath, relativePath);
}
