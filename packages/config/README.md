# @wp-tester/config

Configuration management for wp-tester.

## Features

- Type-safe configuration definitions
- Config file read/write operations
- JSON schema generation and validation
- Configuration option handlers

## Usage

```typescript
import { readConfigFile, WPTesterConfig } from '@wp-tester/config';

const config: WPTesterConfig = await readConfigFile();
```
