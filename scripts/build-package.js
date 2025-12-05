#!/usr/bin/env node
import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

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

console.log('✓ Build complete');
