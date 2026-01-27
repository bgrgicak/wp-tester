import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as https from "node:https";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

/**
 * URL for wp-cli.phar download.
 * This is the same URL used by WordPress Playground.
 */
const WP_CLI_URL = "https://playground.wordpress.net/wp-cli.phar";

/**
 * Default path where wp-cli.phar is mounted in the VFS.
 */
export const WP_CLI_VFS_PATH = "/tmp/wp-cli.phar";

/**
 * Download and cache wp-cli.phar locally.
 *
 * Caches the file at ~/.wp-tester/cache/wp-cli/wp-cli.phar and reuses it
 * across runs. The file is downloaded only once and cached forever since
 * wp-cli.phar is a stable binary that rarely changes.
 *
 * Safe to call concurrently — uses atomic write (temp file + rename) to
 * prevent partial reads.
 *
 * @param baseCacheDir - Optional base cache directory (for testing)
 * @returns Path to cached wp-cli.phar file on the host filesystem
 */
export async function downloadWpCli(baseCacheDir?: string): Promise<string> {
  const cacheBase =
    baseCacheDir || path.join(os.homedir(), ".wp-tester", "cache");
  const cachedPath = path.join(cacheBase, "wp-cli", "wp-cli.phar");

  // Return cached file if it exists and has content
  if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 0) {
    return cachedPath;
  }

  // Ensure cache directory exists
  fs.mkdirSync(path.dirname(cachedPath), { recursive: true });

  // Download to a temp file first, then atomically rename to prevent
  // concurrent callers from reading a partially-written file.
  const tempPath = cachedPath + `.${process.pid}.tmp`;
  try {
    await downloadFile(WP_CLI_URL, tempPath);
    fs.renameSync(tempPath, cachedPath);
    return cachedPath;
  } catch (error) {
    // Clean up partial download
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw new Error(
      `Failed to download wp-cli.phar: ${(error as Error).message}`,
    );
  }
}

/**
 * Download a file from URL with redirect support.
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "wp-tester" } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error("Redirect without location header"));
            return;
          }
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        const fileStream = createWriteStream(destPath);
        pipeline(response, fileStream)
          .then(() => resolve())
          .catch(reject);
      })
      .on("error", reject);
  });
}
