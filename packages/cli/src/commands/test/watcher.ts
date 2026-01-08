import { watch, type FSWatcher } from 'fs';
import picomatch from 'picomatch';
import * as clack from '../../cli/theme';
import { getProjectDir, readConfigFile, type WatchConfig } from '@wp-tester/config';

export interface WatchOptions {
  configPath: string;
  onRunTests: () => Promise<void>;
}

// Default patterns to exclude when watching for changes
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/.DS_Store',
  '**/Thumbs.db',
];

interface WatchMatcher {
  shouldWatch: (filePath: string) => boolean;
}

function createWatchMatcher(watchConfig?: WatchConfig): WatchMatcher {
  // Merge default excludes with user-provided excludes
  const excludePatterns = watchConfig?.exclude ?? DEFAULT_EXCLUDE_PATTERNS;
  const includePatterns = watchConfig?.include;

  // Create picomatch matchers
  const excludeMatcher = picomatch(excludePatterns, { dot: true });
  const includeMatcher = includePatterns
    ? picomatch(includePatterns, { dot: true })
    : null;

  return {
    shouldWatch: (filePath: string): boolean => {
      // Normalize path separators for cross-platform compatibility
      const normalizedPath = filePath.replace(/\\/g, '/');

      // Check if file should be excluded
      if (excludeMatcher(normalizedPath)) {
        return false;
      }

      // Check include patterns if specified
      if (includeMatcher) {
        return includeMatcher(normalizedPath);
      }

      // No include patterns means watch everything (that's not excluded)
      return true;
    },
  };
}

export async function runWatchMode(options: WatchOptions): Promise<void> {
  const { configPath, onRunTests } = options;

  // Resolve config to get the project directory and watch settings
  const config = await readConfigFile(configPath);
  const projectDir = getProjectDir(config, configPath);
  const watchConfig = config.watch;

  // Create the file matcher
  const matcher = createWatchMatcher(watchConfig);

  // Always watch the project directory, use matcher to filter files
  clack.log.info(`Watching for changes in: ${projectDir}`);

  if (watchConfig?.include) {
    clack.log.step(`Include patterns: ${watchConfig.include.join(', ')}`);
  }
  if (watchConfig?.exclude) {
    clack.log.step(`Exclude patterns: ${watchConfig.exclude.join(', ')}`);
  }

  clack.log.info('Press Enter to re-run tests, or q to quit.\n');

  let isRunning = false;
  let pendingRun = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;

  const runTests = async () => {
    if (isRunning) {
      pendingRun = true;
      return;
    }

    isRunning = true;
    console.clear();
    clack.log.info('Running tests...\n');

    try {
      await onRunTests();
    } catch (error) {
      // Tests may exit with non-zero code, which is expected
      if (error instanceof Error && !error.message.includes('process.exit')) {
        clack.log.error(`Error running tests: ${error.message}`);
      }
    } finally {
      isRunning = false;
      clack.log.info('\nWatching for changes... (Enter to re-run, q to quit)');

      if (pendingRun) {
        pendingRun = false;
        await runTests();
      }
    }
  };

  const scheduleRun = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    // Debounce file changes - wait 300ms before running tests
    debounceTimer = setTimeout(() => {
      void runTests();
    }, 300);
  };

  // Set up file watcher
  try {
    watcher = watch(projectDir, { recursive: true }, (eventType, filename) => {
      if (filename && matcher.shouldWatch(filename)) {
        clack.log.step(`File changed: ${filename}`);
        scheduleRun();
      }
    });

    watcher.on('error', (error) => {
      clack.log.error(`Watcher error: ${error.message}`);
    });
  } catch (error) {
    if (error instanceof Error) {
      clack.log.error(`Failed to start watcher: ${error.message}`);
    }
    process.exit(1);
  }

  // Set up keyboard input handling
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key: string) => {
      // Handle Ctrl+C
      if (key === '\u0003') {
        cleanup();
        process.exit(0);
      }
      // Handle 'q' or 'Q' to quit
      if (key === 'q' || key === 'Q') {
        cleanup();
        process.exit(0);
      }
      // Handle Enter to re-run tests
      if (key === '\r' || key === '\n') {
        scheduleRun();
      }
    });
  }

  const cleanup = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (watcher) {
      watcher.close();
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    clack.log.info('\nWatch mode stopped.');
  };

  // Handle process termination
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Run tests initially
  await runTests();

  // Keep the process alive
  await new Promise(() => {
    // This promise never resolves, keeping watch mode running
  });
}
