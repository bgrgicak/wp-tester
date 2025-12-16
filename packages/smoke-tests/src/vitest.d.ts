import type { WPTesterConfig } from '@wp-tester/config';

declare module 'vitest' {
  export interface ProvidedContext {
    config: WPTesterConfig;
  }

  export interface TaskMeta {
    error?: {
      message: string;
      stack?: string;
    };
  }
}
