/**
 * WordPress-themed CLI prompts using @clack/prompts with custom colors
 *
 * WordPress brand colors:
 * - WP Blue: #21759B
 * - Dark Gray: #464646
 */

import * as clack from '@clack/prompts';
import pc from 'picocolors';

// WordPress Blue ANSI color (closest match to #21759B)
// Since terminal colors are limited, we use cyan which is the closest to WordPress blue
const wpBlue = pc.cyan;
const wpDarkGray = pc.gray;

/**
 * Display a WordPress-themed intro message
 */
export const intro = (title: string = ''): void => {
  const styledTitle = wpBlue(pc.bold(title));
  clack.intro(styledTitle);
};

/**
 * Display a WordPress-themed outro message
 */
export const outro = (message: string = ''): void => {
  const styledMessage = wpBlue(message);
  clack.outro(styledMessage);
};

/**
 * Display a WordPress-themed cancel message
 */
export const cancel = (message: string = ''): void => {
  const styledMessage = wpDarkGray(message);
  clack.cancel(styledMessage);
};

/**
 * WordPress-themed note display
 */
export const note = (message: string = '', title: string = ''): void => {
  const styledTitle = title ? wpBlue(pc.bold(title)) : '';
  clack.note(message, styledTitle);
};

/**
 * Re-export all other clack functions for convenience
 */
export {
  text,
  password,
  confirm,
  select,
  selectKey,
  multiselect,
  groupMultiselect,
  log,
  spinner,
  isCancel,
  tasks,
  group,
} from '@clack/prompts';
