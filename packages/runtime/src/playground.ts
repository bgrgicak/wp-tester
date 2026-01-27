/**
 * WordPress Playground lifecycle management
 */

import { runCLI, type RunCLIServer } from "@wp-playground/cli";
import type { ResolvedEnvironment } from "@wp-tester/config";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { Mutex } from "async-mutex";

export const defaultWpCliPath = "/tmp/wp-cli.phar";

/**
 * Global mutex to prevent concurrent WordPress Playground downloads.
 * Multiple parallel tests downloading the same WordPress version cause ENOENT errors
 * when trying to rename .zip.partial files. This mutex serializes only the runCLI call
 * (which triggers downloads) while allowing Playground boot (isReady) to run in
 * parallel across tests.
 */
const playgroundStartMutex = new Mutex();

/**
 * Start a WordPress Playground server from an Environment configuration.
 * Expects environment to be already resolved (blueprint loaded, paths absolute).
 *
 * Uses a global mutex around runCLI() to prevent concurrent download race conditions.
 * Playground boot (isReady) runs outside the mutex for parallel execution.
 */
export async function startPlayground(
  environment: ResolvedEnvironment,
): Promise<RunCLIServer> {
  // Configure mounts from environment
  const mountsBeforeInstall = environment.mounts
    .filter((m) => m.beforeInstall === true)
    .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

  const mountAfterInstall = environment.mounts
    .filter((m) => m.beforeInstall !== true)
    .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }));

  // Blueprint should already be resolved by resolveConfig
  // Create a mutable copy to avoid modifying the original
  const extraLibraries = environment.blueprint.extraLibraries
    ? [...environment.blueprint.extraLibraries]
    : [];

  if (!extraLibraries.includes("wp-cli")) {
    extraLibraries.push("wp-cli");
  }

  const blueprint: BlueprintV1Declaration = {
    ...environment.blueprint,
    extraLibraries,
  };

  // Check if /wordpress/ is being mounted
  const isWordPressMounted = [
    ...mountsBeforeInstall,
    ...mountAfterInstall,
  ].some((m) => m.vfsPath === "/wordpress/" || m.vfsPath === "/wordpress");

  // Only serialize runCLI() which triggers WordPress .zip downloads.
  // This prevents .zip.partial rename race conditions.
  const cli = await playgroundStartMutex.runExclusive(() =>
    runCLI({
      command: "server",
      blueprint,
      mount: mountAfterInstall,
      "mount-before-install": mountsBeforeInstall,
      quiet: true,
      internalCookieStore: true,
      port: 0, // Use any available port to avoid EADDRINUSE errors
      skipWordPressSetup: isWordPressMounted,
    }),
  );

  // Wait for Playground to be ready OUTSIDE the mutex.
  // This is the expensive part (WordPress install, plugin activation, etc.)
  // and can safely run in parallel across tests.
  await cli.playground.isReady();
  return cli;
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
