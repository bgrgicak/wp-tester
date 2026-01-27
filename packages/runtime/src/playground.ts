/**
 * WordPress Playground lifecycle management
 */

import { runCLI, type RunCLIServer } from "@wp-playground/cli";
import type { ResolvedEnvironment } from "@wp-tester/config";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { Mutex } from "async-mutex";
import { downloadWpCli, WP_CLI_VFS_PATH } from "./wp-cli-cache.js";

export const defaultWpCliPath = WP_CLI_VFS_PATH;

/**
 * Global mutex to prevent concurrent WordPress Playground downloads.
 * Multiple parallel tests downloading the same WordPress version cause ENOENT errors
 * when trying to rename .zip.partial files. This mutex serializes the Playground
 * startup while allowing wp-cli download to run outside the lock.
 */
const playgroundStartMutex = new Mutex();

/**
 * Start a WordPress Playground server from an Environment configuration.
 * Expects environment to be already resolved (blueprint loaded, paths absolute).
 *
 * Uses a global mutex to prevent concurrent downloads that cause race conditions.
 * wp-cli download runs outside the mutex since it has its own caching.
 */
export async function startPlayground(
  environment: ResolvedEnvironment,
): Promise<RunCLIServer> {
  // Download and cache wp-cli.phar locally before acquiring the mutex.
  // This has its own file-based caching and is safe to call concurrently.
  const wpCliHostPath = await downloadWpCli();

  return await playgroundStartMutex.runExclusive(async () => {
    // Configure mounts from environment
    const mountsBeforeInstall = environment.mounts
      .filter((m) => m.beforeInstall === true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

    const mountAfterInstall = environment.mounts
      .filter((m) => m.beforeInstall !== true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

    mountAfterInstall.push({
      hostPath: wpCliHostPath,
      vfsPath: WP_CLI_VFS_PATH,
    });

    const blueprint: BlueprintV1Declaration = {
      ...environment.blueprint,
    };

    const isWordPressMounted = [
      ...mountsBeforeInstall,
      ...mountAfterInstall,
    ].some((m) => m.vfsPath === "/wordpress/" || m.vfsPath === "/wordpress");

    const cli = await runCLI({
      command: "server",
      blueprint,
      mount: mountAfterInstall,
      "mount-before-install": mountsBeforeInstall,
      quiet: true,
      internalCookieStore: true,
      port: 0, // Use any available port to avoid EADDRINUSE errors
      skipWordPressSetup: isWordPressMounted,
    });
    await cli.playground.isReady();
    return cli;
  });
}

/**
 * Stop a WordPress Playground runtime and cleanup resources
 *
 * @param runtime - The runtime object returned by startPlayground()
 */
export function stopPlayground(runtime: RunCLIServer | null): void {
  if (runtime?.server) {
    runtime.server.close();
  }
}
