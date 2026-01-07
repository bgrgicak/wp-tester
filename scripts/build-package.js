#!/usr/bin/env node
import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function run(cmd, description) {
  console.log(`→ ${description}...`);
  execSync(cmd, { stdio: 'inherit' });
}

// Build with TypeScript
run('tsc', 'Compiling TypeScript');
run('tsc-alias -f', 'Resolving path aliases');

// Copy schema.json if it exists in src/
if (existsSync('src/schema.json')) {
  console.log('→ Copying schema.json...');
  copyFileSync('src/schema.json', 'dist/schema.json');
}

// Replace build-time constants for smoke-tests package
if (existsSync('dist/index.js') && existsSync('src/smoke-tests')) {
  console.log('→ Replacing build-time constants...');
  const indexPath = join('dist', 'index.js');
  let content = readFileSync(indexPath, 'utf-8');

  // Replace the constants with production values
  content = content
    .replace(/const TEST_DIR = "src";/g, 'const TEST_DIR = "dist";')
    .replace(/const TEST_EXT = "ts";/g, 'const TEST_EXT = "js";')
    .replace(/const CONFIG_FILE = "src\/smoke-tests\/vitest\.config\.ts";/g,
             'const CONFIG_FILE = "dist/smoke-tests/vitest.config.js";');

  writeFileSync(indexPath, content, 'utf-8');
}

console.log('✓ Build complete');
