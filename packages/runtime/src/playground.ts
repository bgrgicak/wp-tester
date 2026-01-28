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
 * Per-version mutexes to prevent concurrent WordPress Playground downloads.
 * Multiple parallel tests downloading the same WordPress version cause ENOENT errors
 * when trying to rename .zip.partial files. These mutexes serialize the download phase
 * per WordPress version, allowing tests with different versions to start in parallel.
 */
const playgroundStartMutexes = new Map<string, Mutex>();

/**
 * Start a WordPress Playground server from an Environment configuration.
 * Expects environment to be already resolved (blueprint loaded, paths absolute).
 *
 * Uses per-version mutexes to prevent concurrent downloads that cause race conditions.
 * Tests with different WordPress versions can start in parallel, while tests with the
 * same version are serialized to prevent download conflicts.
 *
 * wp-cli is downloaded and cached BEFORE acquiring the mutex to avoid holding
 * the lock during a potentially slow network operation (and to avoid deadlock
 * since the download has its own file-based caching).
 */
export async function startPlayground(
  environment: ResolvedEnvironment,
): Promise<RunCLIServer> {
  // Download and cache wp-cli.phar before acquiring the mutex.
  // This is safe to call concurrently — it uses atomic file writes.
  const wpCliHostPath = await downloadWpCli();

  // Get or create a mutex for this specific WordPress version
  // Normalize to "latest" if undefined/empty to ensure consistent mutex sharing
  const wpVersion = environment.blueprint.preferredVersions.wp || "latest";
  if (!playgroundStartMutexes.has(wpVersion)) {
    playgroundStartMutexes.set(wpVersion, new Mutex());
  }
  const mutex = playgroundStartMutexes.get(wpVersion)!;

  // Acquire mutex lock to prevent concurrent Playground downloads for this version
  return await mutex.runExclusive(async () => {
    // Configure mounts from environment
    const mountsBeforeInstall = environment.mounts
      .filter((m) => m.beforeInstall === true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

    const mountAfterInstall = environment.mounts
      .filter((m) => m.beforeInstall !== true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

    // Mount cached wp-cli.phar instead of using extraLibraries
    mountAfterInstall.push({
      hostPath: wpCliHostPath,
      vfsPath: WP_CLI_VFS_PATH,
    });

    const blueprint: BlueprintV1Declaration = {
      ...environment.blueprint,
    };

    // Check if /wordpress/ is being mounted
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

    // Wait for Playground to be ready with a timeout (3 minutes)
    // This prevents indefinite hangs in CI environments
    const PLAYGROUND_READY_TIMEOUT = 180_000;
    const playgroundReadyPromise = cli.playground.isReady();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Playground failed to become ready after ${PLAYGROUND_READY_TIMEOUT}ms`)),
        PLAYGROUND_READY_TIMEOUT
      )
    );

    await Promise.race([playgroundReadyPromise, timeoutPromise]);
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
