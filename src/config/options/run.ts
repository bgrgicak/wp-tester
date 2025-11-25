import type { ConfigOption } from '../types.js';

// TODO Replace with a real option. This is just an example.
export interface RunOption {
  key: 'run';
  /**
   * Enable running built-in tests
   */
  value: boolean;
}

export const runOption: ConfigOption = {
  key: 'run',
  type: 'confirm',
  prompt: 'Do you want to run built-in tests?',
  default: true
};
