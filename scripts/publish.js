#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PACKAGES_TO_PUBLISH = [
  'results',      // No internal deps
  'config',       // No internal deps
  'runtime',      // Depends on config
  'phpunit',      // Depends on config, results, runtime
  'smoke-tests',  // Depends on results, runtime
  'cli',          // Depends on all above
];

function exec(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function getPackageVersion(packageName) {
  const pkgPath = join(process.cwd(), 'packages', packageName, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

function getPackagePath(packageName) {
  return join(process.cwd(), 'packages', packageName, 'package.json');
}

function readPackageJson(packageName) {
  const pkgPath = getPackagePath(packageName);
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

function writePackageJson(packageName, packageJson) {
  const pkgPath = getPackagePath(packageName);
  writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
}

function transformWildcardDependencies(packageName) {
  const pkg = readPackageJson(packageName);
  const originalPkg = JSON.stringify(pkg);
  
  // Transform "*" dependencies to actual versions
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
    if (pkg[depType]) {
      Object.keys(pkg[depType]).forEach(depName => {
        if (pkg[depType][depName] === '*' && depName.startsWith('@wp-tester/')) {
          // Extract package name from scoped package
          const internalPkgName = depName.replace('@wp-tester/', '');
          if (PACKAGES_TO_PUBLISH.includes(internalPkgName)) {
            const version = getPackageVersion(internalPkgName);
            pkg[depType][depName] = `^${version}`;
          }
        }
      });
    }
  });
  
  // Only write if changes were made
  if (JSON.stringify(pkg) !== originalPkg) {
    writePackageJson(packageName, pkg);
    return true;
  }
  return false;
}

function restorePackageJson(packageName, originalContent) {
  const pkgPath = getPackagePath(packageName);
  writeFileSync(pkgPath, originalContent, 'utf-8');
}

function checkNpmLogin() {
  try {
    execSync('npm whoami', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const skipBuild = args.includes('--skip-build');

  console.log('📦 wp-tester Publishing Script\n');

  // Check npm login
  if (!isDryRun && !checkNpmLogin()) {
    console.error('❌ Not logged in to npm. Run: npm login');
    process.exit(1);
  }

  // Build packages
  if (!skipBuild) {
    console.log('🔨 Building all packages...\n');
    try {
      exec('npm run build');
      console.log('\n✓ Build complete\n');
    } catch (error) {
      console.error('\n❌ Build failed.');
      console.error('Error:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⏭️  Skipping build (--skip-build)\n');
  }

  // Show what will be published
  console.log('📋 Packages to publish (in order):\n');
  PACKAGES_TO_PUBLISH.forEach((pkg, i) => {
    const version = getPackageVersion(pkg);
    console.log(`  ${i + 1}. @wp-tester/${pkg}@${version}`);
  });
  console.log('');

  if (isDryRun) {
    console.log('🔍 Dry run mode - checking what would be published...\n');
  }

  // Transform wildcard dependencies before publishing
  console.log('🔄 Transforming wildcard dependencies to actual versions...\n');
  const packageBackups = new Map();
  
  for (const pkg of PACKAGES_TO_PUBLISH) {
    const pkgPath = getPackagePath(pkg);
    const originalContent = readFileSync(pkgPath, 'utf-8');
    packageBackups.set(pkg, originalContent);
    
    const wasTransformed = transformWildcardDependencies(pkg);
    if (wasTransformed) {
      console.log(`  ✓ Transformed dependencies in @wp-tester/${pkg}`);
    }
  }
  console.log('');

  // Publish each package
  let publishError = null;
  
  for (const pkg of PACKAGES_TO_PUBLISH) {
    const version = getPackageVersion(pkg);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Publishing @wp-tester/${pkg}@${version}`);
    console.log('='.repeat(60));

    const publishCmd = [
      'npm publish',
      '--access public',
      isDryRun ? '--dry-run' : '',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      exec(publishCmd, { cwd: join(process.cwd(), 'packages', pkg) });
      console.log(`✓ Published @wp-tester/${pkg}@${version}`);
    } catch (error) {
      console.error(`\n❌ Failed to publish @wp-tester/${pkg}`);
      console.error('Error:', error.message);
      publishError = error;
      break;
    }
  }

  // Restore original package.json files
  console.log('\n🔄 Restoring original package.json files...\n');
  for (const [pkg, originalContent] of packageBackups.entries()) {
    restorePackageJson(pkg, originalContent);
    console.log(`  ✓ Restored @wp-tester/${pkg}/package.json`);
  }
  console.log('');

  // Exit with error if publishing failed
  if (publishError) {
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  if (isDryRun) {
    console.log('✓ Dry run complete - all packages ready to publish');
    console.log('\nTo publish for real, run:');
    console.log('  npm run publish');
  } else {
    console.log('✓ All packages published successfully!');
    console.log('\nUsers can now install with:');
    console.log('  npx @wp-tester/cli');
    console.log('  npm install -g @wp-tester/cli');
  }
  console.log('='.repeat(60) + '\n');
}

main();
