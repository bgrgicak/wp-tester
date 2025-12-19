# Publishing Guide

## First Time Setup

1. **Create npm account** (if you don't have one):
   ```bash
   npm adduser
   ```

2. **Login to npm**:
   ```bash
   npm login
   ```

3. **Update package.json files** to use explicit versions instead of `*`:

   Find all instances of:
   ```json
   "@wp-tester/config": "*"
   ```

   Replace with:
   ```json
   "@wp-tester/config": "0.0.1"
   ```

   Or, to allow non-breaking updates, you can use a caret range:
   ```json
   "@wp-tester/config": "^0.0.1"
   ```

## Publishing Workflow

### Quick Publish

```bash
# 1. Test everything works
npm test

# 2. Dry run to check what will be published
npm run publish:dry-run

# 3. Publish to npm
npm run publish
```

### Manual Steps

If you prefer to do it step by step:

```bash
# 1. Build all packages
npm run build

# 2. Test
npm test

# 3. Publish with dry run first
npm run publish:dry-run

# 4. Actually publish
npm run publish

# 5. Tag and push
git tag v0.0.1
git push && git push --tags
```

### Update Version Before Publishing

```bash
# Update version in all package.json files manually, or:

# Patch release (0.0.1 -> 0.0.2)
npm version patch --workspaces

# Minor release (0.0.1 -> 0.1.0)
npm version minor --workspaces

# Major release (0.0.1 -> 1.0.0)
npm version major --workspaces
```

## What Gets Published

The script publishes these packages in order:

1. `@wp-tester/results`
2. `@wp-tester/config`
3. `@wp-tester/runtime`
4. `@wp-tester/phpunit`
5. `@wp-tester/smoke-tests`
6. `@wp-tester/cli`

**Not published:**
- `@wp-tester/test-fixtures` (dev only)

## After Publishing

Users can install with:

```bash
# Run without installing
npx @wp-tester/cli --version

# Or install globally
npm install -g @wp-tester/cli
wp-tester --version
```

## Troubleshooting

### "You must sign up for private packages"
Make sure the `--access public` flag is in the publish command (it is in the script).

### "Cannot publish over existing version"
You need to bump the version number in package.json files before publishing again.

### "workspace:* in dependencies"
If using npm (not pnpm), you need to replace `workspace:*` with actual version numbers like `"0.0.1"`.

### "Package name already taken"
The `@wp-tester` scope might be taken. You can:
- Claim it if it's unclaimed
- Use your npm username: `@yourusername/wp-tester-cli`

## Script Options

```bash
# Dry run (shows what would be published)
npm run publish:dry-run

# Skip build step (if already built)
node scripts/publish.js --skip-build

# Combine options
node scripts/publish.js --dry-run --skip-build
```

## Checking Published Packages

After publishing, verify on npm:
- https://www.npmjs.com/package/@wp-tester/cli
- https://www.npmjs.com/package/@wp-tester/config
- https://www.npmjs.com/package/@wp-tester/phpunit
- https://www.npmjs.com/package/@wp-tester/results
- https://www.npmjs.com/package/@wp-tester/runtime
- https://www.npmjs.com/package/@wp-tester/smoke-tests
