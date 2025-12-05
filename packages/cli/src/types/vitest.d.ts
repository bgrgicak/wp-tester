import 'vitest';
import type { Environment, Tests } from '@wp-tester/config';

declare module 'vitest' {
  export interface ProvidedContext {
    environments: Environment[];
    tests: Tests;
  }
}
