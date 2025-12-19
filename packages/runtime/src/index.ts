/**
 * WordPress Playground Testing Environment
 *
 * Provides WordPress Playground environment setup and utilities for testing.
 */

import { runCLI, type RunCLIServer } from "@wp-playground/cli";
import type { PHPRequest, PHPResponse, RemoteAPI } from "@php-wasm/universal";
import type { ResolvedEnvironment } from "@wp-tester/config";
import { PlaygroundCliBlueprintV1Worker } from "@wp-playground/cli/blueprints-v1/worker-thread-v1";
import { PlaygroundCliBlueprintV2Worker } from "@wp-playground/cli/blueprints-v2/worker-thread-v2";

export const defaultWpCliPath = "/tmp/wp-cli.phar";

// Re-export types that test packages will need
export type { BlueprintV1Declaration as Blueprint } from "@wp-playground/blueprints";
export type { Mount } from "@wp-playground/cli/mounts";

export type { RunCLIServer } from "@wp-playground/cli";

// TODO Remove once @wp-playground/cli exports this type
type PlaygroundCliWorker =
  | PlaygroundCliBlueprintV1Worker
  | PlaygroundCliBlueprintV2Worker;

/**
 * Start a WordPress Playground server from an Environment configuration.
 * Expects environment to be already resolved (blueprint loaded, paths absolute).
 */
export async function startPlayground(
  environment: ResolvedEnvironment
): Promise<RunCLIServer> {
  // Configure mounts from environment
  const mountsBeforeInstall = [];
  const mountAfterInstall = [];

  // Separate mounts into beforeInstall and afterInstall
  if (environment.mounts) {
    mountsBeforeInstall.push(
      ...environment.mounts
        .filter((m) => m.beforeInstall === true)
        .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }))
    );
    mountAfterInstall.push(
      ...environment.mounts
        .filter((m) => m.beforeInstall !== true)
        .map((m) => ({ hostPath: m.hostPath, vfsPath: m.vfsPath }))
    );
  }

  // Blueprint should already be resolved by resolveConfig
  // Create a mutable copy to avoid modifying the original
  const blueprint = { ...environment.blueprint };
  if (!blueprint.extraLibraries) {
    blueprint.extraLibraries = [];
  }
  if (!blueprint.extraLibraries.includes("wp-cli")) {
    blueprint.extraLibraries.push("wp-cli");
  }

  return await runCLI({
    command: "server",
    blueprint,
    mount: mountAfterInstall,
    "mount-before-install": mountsBeforeInstall,
    quiet: true,
    internalCookieStore: true,
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

/**
 * Run WP CLI command in WordPress Playground
 * and return the result.
 *
 * If --format=json is passed, the result is parsed as JSON,
 * otherwise the raw stdout text is returned.
 *
 * @param playground - The playground instance
 * @param args - The WP CLI arguments
 * @returns The CLI command result
 */
export async function wpCli(
  playground: RemoteAPI<PlaygroundCliWorker>,
  args: string[]
): Promise<object | string> {
  const result = await playground.cli([
    "php",
    defaultWpCliPath,
    `--path=${await playground.documentRoot}`,
    ...args,
  ]);

  if (args.includes("--format=json")) {
    try {
      return JSON.parse(await result.stdoutText) as object;
    } catch (e) {
      throw new Error(
        `Failed to parse WP CLI output: ${(e as Error).message}
        Output was: ${await result.stdoutText}`
      );
    }
  }
  return await result.stdoutText;
}

/**
 * Make a request to WordPress Playground
 *
 * @param playground - The playground instance
 * @param phpRequest - The PHP request object
 * @param redirect - How to handle redirects: 'follow' (default), 'error', or 'manual'
 * @param maxRedirects - Maximum number of redirects to follow (default: 20)
 * @returns The PHP response
 */
export async function request(
  playground: RemoteAPI<PlaygroundCliWorker>,
  phpRequest: PHPRequest,
  redirect: "follow" | "error" | "manual" = "follow",
  maxRedirects: number = 20,
  _redirectCount: number = 0
): Promise<PHPResponse> {
  const response = await playground.request(phpRequest);

  if (
    redirect === "follow" &&
    response.httpStatusCode >= 300 &&
    response.httpStatusCode < 400 &&
    response.headers.location
  ) {
    if (_redirectCount >= maxRedirects) {
      throw new Error(
        `Too many redirects (${_redirectCount}). Last redirect was to ${response.headers.location[0]}`
      );
    }
    return request(
      playground,
      {
        url: response.headers.location[0],
      },
      redirect,
      maxRedirects,
      _redirectCount + 1
    );
  }
  if (
    redirect === "error" &&
    response.httpStatusCode >= 300 &&
    response.httpStatusCode < 400
  ) {
    throw new Error(
      `Redirect encountered: ${response.httpStatusCode} to ${response.headers.location?.[0]}`
    );
  }
  return response;
}
