/**
 * WordPress Playground Testing Environment
 *
 * Provides WordPress Playground environment setup and utilities for testing.
 */

import { runCLI, type RunCLIServer } from "@wp-playground/cli";
import type { PHPRequest, PHPResponse, RemoteAPI } from "@php-wasm/universal";
import type { Environment } from "@wp-tester/config";
import { PlaygroundCliBlueprintV1Worker } from "@wp-playground/cli/blueprints-v1/worker-thread-v1";
import { PlaygroundCliBlueprintV2Worker } from "@wp-playground/cli/blueprints-v2/worker-thread-v2";

// Re-export types that test packages will need
export type { BlueprintV1Declaration as Blueprint } from "@wp-playground/blueprints";
export type { Mount } from "@wp-playground/cli/mounts";

export type { RunCLIServer } from "@wp-playground/cli";

// TODO Remove once @wp-playground/cli exports this type
type PlaygroundCliWorker =
  | PlaygroundCliBlueprintV1Worker
  | PlaygroundCliBlueprintV2Worker;

/**
 * Start a WordPress Playground server from an Environment configuration
 */
export async function startPlayground(
  environment: Environment
): Promise<RunCLIServer> {
  return await runCLI({
    command: "server",
    blueprint: environment.blueprint,
    mount: environment.mounts || [],
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
