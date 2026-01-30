import type { WPTesterConfig } from "./wp-tester-config";
import type { ResolvedWPTesterConfig, ResolvedEnvironment, ResolvedTests, ResolvedBlueprint, ResolvedReporters, ResolvedPath, ResolvedJsonReporterOptions } from "./resolved-types";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { getProjectRootMount } from "./auto-mount";
import { detectProjectType } from "./options/project-type-detect";
import { getProjectDir, resolveAbsolute, normalizeConfigPath } from "./path-utils";
import { expandEnvironments } from "./environment-resolver";
import { resolveTests } from "./test-resolver";

export type { WPTesterConfig } from "./wp-tester-config";

/**
 * Resolve config from path or object and adjust relative paths to absolute paths
 * @param config - Config file path or config object
 * @returns Config with all paths resolved to absolute paths, blueprints loaded, and all required fields set
 */
export async function resolveConfig(
  config: WPTesterConfig | string
): Promise<ResolvedWPTesterConfig> {
  let resolvedConfig: WPTesterConfig;
  let configPath: string | undefined;

  if (typeof config === "string") {
    // Normalize the path (handles directory paths)
    configPath = normalizeConfigPath(config);

    const content = await readFile(configPath, "utf8");
    resolvedConfig = JSON.parse(content) as WPTesterConfig;
  } else {
    // Config object provided
    resolvedConfig = config;
    configPath = undefined;
  }

  // Get the project root directory (respects projectHostPath config option)
  const projectDir = getProjectDir(resolvedConfig, configPath);

  // Ensure projectType is set (detect if not provided)
  // Skip detection if directory doesn't exist to avoid filesystem errors in tests
  // that intentionally use invalid paths for error handling
  let projectType = resolvedConfig.projectType;
  if (!projectType && existsSync(projectDir)) {
    try {
      projectType = detectProjectType(projectDir);
    } catch {
      // If detection fails (e.g., permission errors), default to 'other'
      projectType = 'other';
    }
  } else if (!projectType) {
    // Directory doesn't exist, default to 'other'
    projectType = 'other';
  }

  // Ensure reporters is set with defaults
  // If no reporters configured, default to showing all test statuses
  const defaultReporterOptions = {
    passed: true,
    failed: true,
    skipped: true,
    pending: true,
    other: true,
  };

  const reporters: ResolvedReporters = {
    default: undefined, // Will be set below
    json: undefined, // Will be set below if configured
  };

  // Normalize default reporter:
  // - `true` or empty object `{}` -> apply default options (show all)
  // - `false` -> disable default reporter (remove it)
  // - object with options -> use as-is
  const inputDefault = resolvedConfig.reporters?.default;
  if (inputDefault === true || inputDefault === undefined || (typeof inputDefault === 'object' && Object.keys(inputDefault).length === 0)) {
    // true, undefined, or empty object -> use defaults (show all)
    if (inputDefault !== undefined || !resolvedConfig.reporters?.json) {
      reporters.default = defaultReporterOptions;
    }
  } else if (inputDefault === false) {
    // false -> disable default reporter
    reporters.default = undefined;
  } else {
    // Object with specific options -> use as-is
    reporters.default = inputDefault;
  }

  // Resolve JSON reporter if configured
  // Note: JSON reporter only has outputFile option - filter options are not supported
  // (filter only affects console display, not JSON output)
  const inputJson = resolvedConfig.reporters?.json;
  if (inputJson === true || (typeof inputJson === 'object' && inputJson !== null)) {
    // Get config directory for default output path
    const configDir = configPath ? dirname(configPath) : projectDir;
    const defaultOutputFile = join(configDir, "wp-tester-results.json");

    // Handle boolean shorthand: true or {} both use default outputFile
    const outputFile = inputJson === true || !inputJson.outputFile
      ? defaultOutputFile
      : resolveAbsolute(inputJson.outputFile, configDir);

    const resolvedJson: ResolvedJsonReporterOptions = {
      outputFile,
    };
    reporters.json = resolvedJson;
  }

  // Expand environments with version arrays into multiple environments
  const expandedEnvironments = await expandEnvironments(
    resolvedConfig.environments,
    projectDir
  );

  // Resolve environments: convert ExpandedEnvironment[] to ResolvedEnvironment[]
  const resolvedEnvironments: ResolvedEnvironment[] = await Promise.all(
    expandedEnvironments.map(async (env) => {
      // Resolve blueprint from string to BlueprintV1Declaration if needed
      // If no blueprint is provided, use an empty object (defaults will be applied later)
      let blueprint: BlueprintV1Declaration;
      if (!env.blueprint) {
        blueprint = {};
      } else if (typeof env.blueprint === "string") {
        const blueprintPath = resolveAbsolute(env.blueprint, projectDir);
        const blueprintContent = await readFile(blueprintPath, "utf-8");
        blueprint = JSON.parse(blueprintContent) as BlueprintV1Declaration;
      } else {
        blueprint = env.blueprint;
      }

      // Determine PHP version:
      // 1. Use the expanded version from matrix (_phpVersion) if set
      // 2. Otherwise use blueprint preferredVersions.php if set
      // 3. Otherwise default to "latest"
      const phpVersion = env._phpVersion || blueprint.preferredVersions?.php || "latest";

      // Determine WP version:
      // 1. Use the expanded version from matrix (_wpVersion) if set
      // 2. Otherwise use blueprint preferredVersions.wp if set
      // 3. Otherwise default to "latest"
      const wpVersion = env._wpVersion || blueprint.preferredVersions?.wp || "latest";

      // Create resolved blueprint with determined versions
      // Type assertion is needed because the versions come from user config
      // and TypeScript can't verify at compile time that they're valid.
      // Invalid versions will be caught by WordPress Playground at runtime.
      const resolvedBlueprint: ResolvedBlueprint = {
        ...blueprint,
        preferredVersions: {
          php: phpVersion as ResolvedBlueprint['preferredVersions']['php'],
          wp: wpVersion,
        },
      };

      // Auto-detect and add mounts if needed
      let mounts = env.mounts ? [...env.mounts] : []; // Create a copy to avoid mutating original

      // Always add the project root mount if the directory exists
      // This ensures the project root is accessible even when custom mounts are specified
      if (existsSync(projectDir)) {
        // Use projectVFSPath if specified, otherwise derive from projectType
        const baseMount = resolvedConfig.projectVFSPath
          ? { hostPath: projectDir, vfsPath: resolvedConfig.projectVFSPath }
          : getProjectRootMount(projectDir, projectType);

        if (baseMount) {
          // Auto-mounts use beforeInstall: true so the project is available
          // before the blueprint runs (e.g., for activatePlugin steps)
          const mount = { ...baseMount, beforeInstall: true };

          // Check if this mount already exists (by vfsPath) to avoid duplicates
          // Normalize paths by removing trailing slashes for comparison
          const normalizeVfsPath = (path: string) => path.replace(/\/+$/, '');
          const mountVfsPath = normalizeVfsPath(mount.vfsPath);
          const existingMount = mounts.find(m => normalizeVfsPath(m.vfsPath) === mountVfsPath);
          if (!existingMount) {
            // Prepend auto-mount so custom mounts can override if needed
            mounts = [mount, ...mounts];
          }
        }
      }

      // Resolve relative mount paths to absolute paths
      const resolvedMounts = mounts.map((mount) => ({
        ...mount,
        hostPath: resolveAbsolute(mount.hostPath, projectDir),
      }));

      // Sort mounts by VFS path depth (shallowest first, deepest last).
      // WordPress Playground applies mounts in order, with later mounts taking precedence.
      // By mounting parent paths first and child paths last, child mounts can override
      // parent mounts when paths overlap.
      // Example: /wordpress/wp-content/plugins should come before /wordpress/wp-content/plugins/foo
      resolvedMounts.sort((a, b) => {
        const depthA = a.vfsPath.split('/').filter(Boolean).length;
        const depthB = b.vfsPath.split('/').filter(Boolean).length;
        return depthA - depthB; // Sort ascending (shallowest first)
      });

      return {
        name: env.name,
        blueprint: resolvedBlueprint,
        mounts: resolvedMounts,
        env: env.env || {},
        skip: env.skip ?? false,
      };
    })
  );

  // Determine project VFS path
  let projectVFSPath: string;
  if (resolvedConfig.projectVFSPath !== undefined) {
    // Explicitly specified in config
    projectVFSPath = resolvedConfig.projectVFSPath;
  } else {
    // Auto-detect from projectType
    const mount = getProjectRootMount(projectDir, projectType);
    if (mount?.vfsPath) {
      projectVFSPath = mount.vfsPath;
    } else {
      // For "other" project types without explicit projectVFSPath,
      // fall back to projectDir but validate it looks like a path
      if (projectType === "other" && !projectDir.startsWith("/")) {
        throw new Error(
          `Cannot auto-detect mount path for projectType "other". ` +
          `Please specify "projectVFSPath" in your config to indicate where your project directory should be mounted (e.g., "/project", "/wordpress/wp-content/mu-plugins/my-plugin").`
        );
      }
      projectVFSPath = projectDir;
    }
  }

  // Create project path with both host and VFS paths
  const projectPath: ResolvedPath = {
    hostPath: projectDir,
    vfsPath: projectVFSPath,
  };

  // Resolve PHPUnit paths to absolute paths and ensure testMode has a default
  const resolvedTests: ResolvedTests = await resolveTests(
    resolvedConfig.tests,
    projectPath
  );

  // Return fully resolved config with all required fields
  return {
    ...resolvedConfig,
    projectPath,
    projectType,
    reporters,
    environments: resolvedEnvironments,
    tests: resolvedTests,
  };
}
