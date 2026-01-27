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
   *
   * Ignored when useEtagValidation is true.
   */
  cacheExpiration?: number;

  /**
   * Use HTTP ETag/Last-Modified headers for cache validation.
   * When true, makes a conditional request to check if the remote file has changed.
   * Only re-downloads if the server returns a new version (ignores cacheExpiration).
   * Falls back to cached file if the server is unreachable.
   */
  useEtagValidation?: boolean;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
}

interface CacheMetadata {
  etag?: string;
  lastModified?: string;
  contentLength?: number;
}

/**
 * Read cache metadata (ETag, Last-Modified) from file
 */
function readCacheMetadata(metadataPath: string): CacheMetadata | null {
  try {
    if (fs.existsSync(metadataPath)) {
      const content = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content) as CacheMetadata;
    }
  } catch {
    // Ignore parse errors, treat as no metadata
  }
  return null;
}

/**
 * Write cache metadata to file
 */
function writeCacheMetadata(metadataPath: string, metadata: CacheMetadata): void {
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Check if remote file has changed using HEAD request.
 * Compares Content-Length as a simple validation when ETag/Last-Modified aren't available.
 * Returns: { changed: false } if not modified, { changed: true } if modified
 */
function checkRemoteChanged(
  url: string,
  metadata: CacheMetadata
): Promise<{ changed: boolean }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = { 'User-Agent': 'wp-tester' };

    // Use conditional headers if available
    if (metadata.etag) {
      headers['If-None-Match'] = metadata.etag;
    }
    if (metadata.lastModified) {
      headers['If-Modified-Since'] = metadata.lastModified;
    }

    // Use HEAD request to avoid downloading the file just to check
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'HEAD',
      headers,
    };

    const req = https.request(options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          void checkRemoteChanged(redirectUrl, metadata).then(resolve);
          return;
        }
      }

      if (response.statusCode === 304) {
        // Not modified - cached version is still valid
        resolve({ changed: false });
      } else if (response.statusCode === 200) {
        // Check Content-Length if we have it stored
        if (metadata.contentLength !== undefined) {
          const remoteLength = parseInt(response.headers['content-length'] || '0', 10);
          if (remoteLength === metadata.contentLength) {
            // Same size - assume not changed
            resolve({ changed: false });
            return;
          }
        }
        // Modified or no Content-Length to compare
        resolve({ changed: true });
      } else {
        // Other status codes - assume not changed to be safe
        resolve({ changed: false });
      }
    });

    req.on('error', () => {
      // Network error - fall back to cached version
      resolve({ changed: false });
    });

    req.end();
  });
}

/**
 * Extract cache metadata from response headers
 */
function extractMetadata(response: import('http').IncomingMessage): CacheMetadata {
  const metadata: CacheMetadata = {};
  if (response.headers.etag) {
    metadata.etag = response.headers.etag;
  }
  if (response.headers['last-modified']) {
    metadata.lastModified = response.headers['last-modified'];
  }
  if (response.headers['content-length']) {
    metadata.contentLength = parseInt(response.headers['content-length'], 10);
  }
  return metadata;
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
    useEtagValidation = false,
    maxRetries = 1,
  } = options;

  const cacheDir = path.join(baseCacheDir, cacheKey);
  const cacheFilePath = path.join(cacheDir, 'download');
  const metadataPath = path.join(cacheDir, 'metadata.json');

  // ETag/Content-Length based validation: check if remote has changed
  if (useEtagValidation && fs.existsSync(cacheFilePath)) {
    const metadata = readCacheMetadata(metadataPath);
    const localStats = fs.statSync(cacheFilePath);

    // If we have metadata with contentLength, validate local file size matches
    if (metadata?.contentLength !== undefined && localStats.size === metadata.contentLength) {
      // File size matches - assume file is still valid (no network request needed)
      try {
        if (url.endsWith('.zip')) {
          validateZipFile(cacheFilePath);
        }
        return cacheFilePath;
      } catch {
        // Cached file is corrupted, will re-download below
      }
    } else if (metadata && (metadata.etag || metadata.lastModified)) {
      // Have ETag/Last-Modified but no content length - make HEAD request to check
      const result = await checkRemoteChanged(url, metadata);

      if (!result.changed) {
        // File hasn't changed, validate and return cached version
        try {
          if (url.endsWith('.zip')) {
            validateZipFile(cacheFilePath);
          }
          // Update metadata with actual file size for future runs
          metadata.contentLength = localStats.size;
          writeCacheMetadata(metadataPath, metadata);
          return cacheFilePath;
        } catch {
          // Cached file is corrupted, will re-download below
        }
      }
      // If changed, fall through to download section below
    } else if (localStats.size > 0) {
      // No metadata but file exists with content - validate and return it
      // Save the file size as metadata for future runs
      try {
        if (url.endsWith('.zip')) {
          validateZipFile(cacheFilePath);
        }
        writeCacheMetadata(metadataPath, { contentLength: localStats.size });
        return cacheFilePath;
      } catch {
        // Cached file is corrupted, delete it
        fs.unlinkSync(cacheFilePath);
      }
    }
  }

  // Time-based cache validation (original behavior)
  if (!useEtagValidation && fs.existsSync(cacheFilePath)) {
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
    const metadata = await downloadFileWithRetryAndMetadata(url, cacheFilePath, maxRetries);

    // Save metadata for future validation
    if (useEtagValidation) {
      // Get actual file size if not in response headers
      if (metadata.contentLength === undefined) {
        const stats = fs.statSync(cacheFilePath);
        metadata.contentLength = stats.size;
      }
      writeCacheMetadata(metadataPath, metadata);
    }

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
 * Download a file from URL with redirect support, returning metadata
 */
async function downloadFile(url: string, destPath: string): Promise<CacheMetadata> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wp-tester' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
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
        .then(() => {
          resolve(extractMetadata(response));
        })
        .catch(reject);
    }).on('error', reject);
  });
}

/**
 * Download file with retry logic and exponential backoff, returning metadata
 */
async function downloadFileWithRetryAndMetadata(
  url: string,
  destPath: string,
  maxRetries: number
): Promise<CacheMetadata> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await downloadFile(url, destPath);
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
