// Types
export type {
  WPTesterConfig,
  EnvironmentVariables,
  Environment,
  Tests,
  PHPUnitConfig,
  TestType,
  Reporters,
  BaseReporterOptions,
  DefaultReporterOptions,
  Mount,
  Blueprint,
  JsonReporterOptions,
  WatchConfig,
} from "./types";

// Resolved types (after resolveConfig())
export type {
  ResolvedEnvironment,
  ResolvedWPTesterConfig,
  ResolvedPHPUnitConfig,
  ResolvedTests,
  ResolvedBlueprint,
  ResolvedReporters,
  ResolvedPath,
} from './resolved-types';

// Functions
export {
  resolveConfig,
} from "./config";

export {
  readConfigFile,
  writeConfigFile,
  getDefaultConfig,
  isConfigWritable,
} from "./config-file";

export {
  configPath,
  getSchemaPath,
  getProjectDir,
  getConfigDir,
  getConfigPath,
  normalizeConfigPath,
  resolveAbsolute,
  getWorkingDirectory,
  toResolvedPath,
} from "./path-utils";

export {
  resolvePhpunitArgs,
  resolveTests,
} from "./test-resolver";

export {
  expandEnvironments,
  type ExpandedEnvironment,
} from "./environment-resolver";

export { getProjectRootMount } from './auto-mount';
export { hostToVfs, vfsToHost } from './path-mappers';
export type { ProjectType } from './options/project-type-detect';

// Options
export { optionNames, optionMap, setupOptions, type OptionName, type ConfigOption, type ConfigOptionContext } from './options/index';
export { smokeTestsOption } from './options/smoke-tests';
export { phpunitOption } from './options/phpunit';
export { findPhpUnitConfig, findPhpUnitExecutable, parseBootstrapPath } from './options/phpunit-detect';