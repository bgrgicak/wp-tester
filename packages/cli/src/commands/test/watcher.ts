import { watch, type FSWatcher } from 'fs';
import * as clack from '../../cli/theme';
import { resolveConfig, getProjectDir, readConfigFile } from '@wp-tester/config';

export interface WatchOptions {
  configPath: string;
  onRunTests: () => Promise<void>;
}

// Patterns to ignore when watching for changes
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.svn/,
  /\.hg/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /\.idea/,
  /\.vscode/,
  /\.cache/,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.log$/,
  /\.tmp$/,
  /\.temp$/,
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

export async function runWatchMode(options: WatchOptions): Promise<void> {
  const { configPath, onRunTests } = options;

  // Resolve config to get the project directory
  const config = await readConfigFile(configPath);
  const projectDir = getProjectDir(config, configPath);

  clack.log.info(`Watching for changes in: ${projectDir}`);
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
      if (filename && !shouldIgnore(filename)) {
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
