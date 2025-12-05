# @wp-tester/runtime

WordPress Playground testing environment library.

Provides utilities for testing with WordPress Playground.

## Features

- Start and stop WordPress Playground servers with Blueprint configurations
- Make HTTP requests to WordPress instances with automatic redirect handling
- Type-safe environment configuration
- Built on `@wp-playground/cli` and `@wp-playground/blueprints`

## Usage

```typescript
import { startPlayground, stopPlayground, request } from '@wp-tester/runtime';

// Start a WordPress instance
const runtime = await startPlayground({
  blueprint: {
    login: true,
    // ... other blueprint configuration
  },
  mounts: [
    {
      source: '.',
      target: '/wordpress/wp-content/plugins/my-plugin',
    }
  ]
});

// Make requests to WordPress
const response = await request(runtime.playground, {
  url: '/wp-admin/',
});

// Cleanup
await stopPlayground(runtime);
```

## Development

```bash
# Build
npm run build

# Test
npm run test
```
