import type { Environment } from "./wp-tester-config";
import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import { readFile } from "fs/promises";
import { resolveAbsolute } from "./path-utils";

/**
 * Internal interface for expanded environments with resolved version arrays.
 * This is used internally during expansion before full resolution.
 */
export interface ExpandedEnvironment extends Environment {
  /** The specific PHP version for this expanded environment */
  _phpVersion?: string;
  /** The specific WP version for this expanded environment */
  _wpVersion?: string;
}

/**
 * Normalize a version spec (string or array) to an array of versions.
 * @param spec - Version specification (single string or array)
 * @returns Array of version strings
 */
function normalizeVersionSpec(spec: string | string[] | undefined): string[] {
  if (!spec) {
    return [];
  }
  return Array.isArray(spec) ? spec : [spec];
}

/**
 * Generate a name for an expanded environment based on the original name
 * and the specific PHP/WP versions.
 * @param baseName - Original environment name (if any)
 * @param phpVersion - PHP version for this combination (only if from matrix)
 * @param wpVersion - WordPress version for this combination (only if from matrix)
 * @param phpIsFromMatrix - Whether PHP version is from matrix expansion (not blueprint)
 * @param wpIsFromMatrix - Whether WP version is from matrix expansion (not blueprint)
 * @param isMatrix - Whether this is part of a matrix (multiple combinations)
 * @returns Generated environment name
 */
function generateExpandedName(
  baseName: string | undefined,
  phpVersion: string | undefined,
  wpVersion: string | undefined,
  phpIsFromMatrix: boolean,
  wpIsFromMatrix: boolean,
  isMatrix: boolean
): string | undefined {
  // If not a matrix expansion, keep the original name
  if (!isMatrix) {
    return baseName;
  }

  // Build version suffix - only include versions that are from the matrix
  const parts: string[] = [];
  if (phpVersion && phpIsFromMatrix) {
    parts.push(`PHP ${phpVersion}`);
  }
  if (wpVersion && wpIsFromMatrix) {
    parts.push(`WP ${wpVersion}`);
  }

  if (parts.length === 0) {
    return baseName;
  }

  const versionSuffix = parts.join(", ");
  return baseName ? `${baseName} (${versionSuffix})` : versionSuffix;
}

/**
 * Expand environments with version arrays into multiple environments,
 * one for each combination of PHP and WP versions.
 *
 * Rules:
 * - If blueprint.preferredVersions.php is set, it overrides env.php (no matrix for PHP)
 * - If blueprint.preferredVersions.wp is set, it overrides env.wp (no matrix for WP)
 * - When arrays are provided for both php and wp, creates a full matrix of combinations
 *
 * @param environments - Original environments array
 * @param projectDir - Project directory for resolving blueprint paths
 * @returns Expanded environments array
 */
export async function expandEnvironments(
  environments: Environment[],
  projectDir: string
): Promise<ExpandedEnvironment[]> {
  const expanded: ExpandedEnvironment[] = [];

  for (const env of environments) {
    // Load blueprint if it's a string path (needed to check preferredVersions)
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

    // Determine PHP versions to use
    // Blueprint preferredVersions.php overrides environment-level php
    // However, "latest" is treated as unspecified, allowing matrix expansion
    const blueprintPhp = blueprint.preferredVersions?.php;
    let phpVersions: string[];
    let phpIsFromMatrix: boolean;
    if (blueprintPhp && blueprintPhp !== "latest") {
      // Blueprint takes precedence - use only the blueprint version
      phpVersions = [blueprintPhp];
      phpIsFromMatrix = false; // Not from matrix, from blueprint
    } else {
      // Use environment-level versions
      phpVersions = normalizeVersionSpec(env.php);
      phpIsFromMatrix = true; // From matrix (env-level config)
    }

    // Determine WP versions to use
    // Blueprint preferredVersions.wp overrides environment-level wp
    // However, "latest" is treated as unspecified, allowing matrix expansion
    const blueprintWp = blueprint.preferredVersions?.wp;
    let wpVersions: string[];
    let wpIsFromMatrix: boolean;
    if (blueprintWp && blueprintWp !== "latest") {
      // Blueprint takes precedence - use only the blueprint version
      wpVersions = [blueprintWp];
      wpIsFromMatrix = false; // Not from matrix, from blueprint
    } else {
      // Use environment-level versions
      wpVersions = normalizeVersionSpec(env.wp);
      wpIsFromMatrix = true; // From matrix (env-level config)
    }

    // If no versions specified at either level, create a single environment
    if (phpVersions.length === 0 && wpVersions.length === 0) {
      expanded.push({ ...env });
      continue;
    }

    // Ensure at least one version for each dimension (use empty string as placeholder for "not specified")
    const phpList = phpVersions.length > 0 ? phpVersions : [""];
    const wpList = wpVersions.length > 0 ? wpVersions : [""];

    // Determine if this is a matrix (multiple combinations)
    const isMatrix = phpList.length > 1 || wpList.length > 1;

    // Create combinations
    for (const phpVersion of phpList) {
      for (const wpVersion of wpList) {
        const expandedEnv: ExpandedEnvironment = {
          ...env,
          name: generateExpandedName(
            env.name,
            phpVersion || undefined,
            wpVersion || undefined,
            phpIsFromMatrix,
            wpIsFromMatrix,
            isMatrix
          ),
          _phpVersion: phpVersion || undefined,
          _wpVersion: wpVersion || undefined,
        };
        expanded.push(expandedEnv);
      }
    }
  }

  return expanded;
}
