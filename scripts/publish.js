#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
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

function checkNpmLogin() {
  try {
    execSync('npm whoami', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkVersionExists(packageName, version) {
  try {
    execSync(`npm view @wp-tester/${packageName}@${version}`, { stdio: 'pipe' });
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

  // Publish each package
  for (const pkg of PACKAGES_TO_PUBLISH) {
    const version = getPackageVersion(pkg);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Publishing @wp-tester/${pkg}@${version}`);
    console.log('='.repeat(60));

    // Check if version already exists on npm
    const versionExists = checkVersionExists(pkg, version);
    if (versionExists) {
      if (isDryRun) {
        console.log(`⚠️  Version ${version} already exists on npm`);
      } else {
        console.error(`\n❌ Version ${version} of @wp-tester/${pkg} already exists on npm`);
        console.error(`Please bump the version in packages/${pkg}/package.json and try again.`);
        console.error('You can use: npm version patch|minor|major');
        process.exit(1);
      }
    }

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
      process.exit(1);
    }
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
