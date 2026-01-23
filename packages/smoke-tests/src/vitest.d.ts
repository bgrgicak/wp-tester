import type { ResolvedWPTesterConfig } from '@wp-tester/config';

declare module 'vitest' {
  export interface ProvidedContext {
    config: ResolvedWPTesterConfig;
  }

  export interface TaskMeta {
    error?: {
      message: string;
      stack?: string;
    };
  }
}
