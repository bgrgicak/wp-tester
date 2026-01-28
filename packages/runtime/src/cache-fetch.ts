import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

/**
 * Cache expiration constants for common use cases
 */
export const CACHE_FOREVER = 0;
export const CACHE_DISABLED = -1;
export const CACHE_1_HOUR = 60 * 60 * 1000;
export const CACHE_1_DAY = 24 * 60 * 60 * 1000;
export const CACHE_1_WEEK = 7 * 24 * 60 * 60 * 1000;

export interface CacheFetchOptions {
  /**
   * Base directory for caching (defaults to ~/.wp-tester/cache)
   */
  baseCacheDir?: string;

  /**
   * Subdirectory within the cache (e.g., 'test-lib', 'wp-cli')
   */
  cacheKey: string;

  /**
   * URL to download from
   */
  url: string;

  /**
   * Cache expiration time in milliseconds (defaults to 24 hours)
   * - Positive number: cache expires after that many milliseconds
   * - 0 (CACHE_FOREVER): cache never expires
   * - -1 (CACHE_DISABLED): always re-download, no caching
   */
  cacheExpiration?: number;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
}

/**
 * Validate that a file is a valid zip file by checking for the end of central directory signature
 * The EOCD can have a variable-length comment, so we search backwards from the end
 */
function validateZipFile(filePath: string): void {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;

    // ZIP files must have at least 22 bytes (minimum EOCD size)
    if (fileSize < 22) {
      throw new Error('File too small to be a valid zip file');
    }

    // Maximum comment length is 65535 bytes, so search last 65KB + 22 bytes
    const searchSize = Math.min(fileSize, 65535 + 22);
    const buffer = Buffer.alloc(searchSize);
    fs.readSync(fd, buffer, 0, searchSize, fileSize - searchSize);

    // Search backwards for EOCD signature (0x50, 0x4b, 0x05, 0x06 in little-endian)
    let found = false;
    for (let i = searchSize - 22; i >= 0; i--) {
      if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error('End of central directory record signature not found. Either not a zip file, or file is truncated.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Download a file and cache it locally, with retry logic
 *
 * @param options - Configuration options for cache fetch
 * @returns Path to the cached file
 */
export async function cacheFetch(options: CacheFetchOptions): Promise<string> {
  const {
    baseCacheDir = path.join(os.homedir(), '.wp-tester', 'cache'),
    cacheKey,
    url,
    cacheExpiration = CACHE_1_DAY,
    maxRetries = 1,
  } = options;

  const cacheDir = path.join(baseCacheDir, cacheKey);
  const cacheFilePath = path.join(cacheDir, 'download');

  // Check if cached file exists and is still valid
  if (fs.existsSync(cacheFilePath)) {
    // If cacheExpiration is -1 (CACHE_DISABLED), always re-download
    if (cacheExpiration === -1) {
      // Delete existing cache
      fs.unlinkSync(cacheFilePath);
    }
    // If cacheExpiration is 0 (CACHE_FOREVER), cache never expires
    else if (cacheExpiration === 0) {
      // Validate cached file before returning
      try {
        if (url.endsWith('.zip')) {
          validateZipFile(cacheFilePath);
        }
        return cacheFilePath;
      } catch {
        // Cached file is corrupted, delete and re-download
        fs.unlinkSync(cacheFilePath);
      }
    }
    // For positive values, check if cache has expired
    else {
      const stats = fs.statSync(cacheFilePath);
      const now = Date.now();
      const fileAge = now - stats.mtimeMs;

      if (fileAge < cacheExpiration) {
        // Cache exists and hasn't expired, validate before returning
        try {
          if (url.endsWith('.zip')) {
            validateZipFile(cacheFilePath);
          }
          return cacheFilePath;
        } catch {
          // Cached file is corrupted, delete and re-download
          fs.unlinkSync(cacheFilePath);
        }
      } else {
        // Cache has expired, delete it
        fs.unlinkSync(cacheFilePath);
      }
    }
  }

  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  try {
    await downloadFileWithRetry(url, cacheFilePath, maxRetries);

    // Validate the downloaded file if it's a zip
    if (url.endsWith('.zip')) {
      validateZipFile(cacheFilePath);
    }

    return cacheFilePath;
  } catch (error) {
    // Clean up partial download and cache directory
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }

    throw new Error(
      `Failed to download from ${url}: ${(error as Error).message}`
    );
  }
}

/**
 * Download a file from URL with redirect support
 */
async function downloadFile(url: string, destPath: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'wp-tester' }, timeout: timeoutMs }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        downloadFile(redirectUrl, destPath, timeoutMs).then(resolve).catch(reject);
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
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Download timed out after ${timeoutMs}ms: ${url}`));
    });
}

/**
 * Download file with retry logic and exponential backoff
 */
async function downloadFileWithRetry(
  url: string,
  destPath: string,
  maxRetries: number
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await downloadFile(url, destPath);
      return; // Success
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Download failed after retries');
}
