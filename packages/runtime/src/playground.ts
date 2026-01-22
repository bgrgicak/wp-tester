/**
 * WordPress Playground lifecycle management
 */

import { runCLI, type RunCLIServer } from "@wp-playground/cli";
import type { ResolvedEnvironment } from "@wp-tester/config";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";

export const defaultWpCliPath = "/tmp/wp-cli.phar";

/**
 * Start a WordPress Playground server from an Environment configuration.
 * Expects environment to be already resolved (blueprint loaded, paths absolute).
 */
export async function startPlayground(
  environment: ResolvedEnvironment,
): Promise<RunCLIServer> {
  // Configure mounts from environment
  const mountsBeforeInstall = [];
  const mountAfterInstall = [];

  // Separate mounts into beforeInstall and afterInstall
  mountsBeforeInstall.push(
    ...environment.mounts
      .filter((m) => m.beforeInstall === true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath })),
  );
  mountAfterInstall.push(
    ...environment.mounts
      .filter((m) => m.beforeInstall !== true)
      .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath })),
  );

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
