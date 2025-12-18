#!/usr/bin/env node
import { execSync } from 'child_process';
import { cpSync } from 'fs';

function run(cmd, description) {
  console.log(`→ ${description}...`);
  execSync(cmd, { stdio: 'inherit' });
}

// Build with TypeScript
run('tsc', 'Compiling TypeScript');
run('tsc-alias -f', 'Resolving path aliases');

// Copy fixtures directory to dist
console.log('→ Copying fixtures directory...');
cpSync('fixtures', 'dist/fixtures', { recursive: true });

console.log('✓ Build complete');
