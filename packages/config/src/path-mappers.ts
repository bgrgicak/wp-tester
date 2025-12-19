import { relative, join } from "path";
import type { ResolvedWPTesterConfig } from "./resolved-types";

/**
 * Maps a host filesystem path to its corresponding VFS path in the playground
 *
 * @param hostPath - Absolute path on the host filesystem
 * @param config - Resolved config with projectHostPath and projectVFSPath
 * @returns Corresponding VFS path in the playground
 *
 * @example
 * hostToVfs('/project/tests/bootstrap.php', resolvedConfig)
 * // Returns: '/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php'
 */
export function hostToVfs(
  hostPath: string,
  config: ResolvedWPTesterConfig
): string {
  const relativePath = relative(config.projectHostPath, hostPath);
  return join(config.projectVFSPath, relativePath);
}

/**
 * Maps a VFS path in the playground to its corresponding host filesystem path
 *
 * @param vfsPath - Path in the playground VFS
 * @param config - Resolved config with projectHostPath and projectVFSPath
 * @returns Corresponding absolute path on the host filesystem
 *
 * @example
 * vfsToHost('/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php', resolvedConfig)
 * // Returns: '/project/tests/bootstrap.php'
 */
export function vfsToHost(
  vfsPath: string,
  config: ResolvedWPTesterConfig
): string {
  const relativePath = relative(config.projectVFSPath, vfsPath);
  return join(config.projectHostPath, relativePath);
}
