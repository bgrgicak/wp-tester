import type { WPTesterConfig } from "../types";
import * as clack from "@clack/prompts";
import { mkdir, writeFile, access, readFile } from "fs/promises";
import { join, dirname, relative } from "path";
import { execSync } from "child_process";
import pc from "picocolors";
import { getProjectDir } from "../path-utils";

const WORKFLOW_PATH = ".github/workflows/wp-tester.yml";

/**
 * Workflow configuration options
 */
interface WorkflowConfig {
  workflowName: string;
  branches: string[];
  nodeVersion: string;
  enableCaching: boolean;
  wpTesterArgs: string;
  enableComposerInstall: boolean;
  composerWorkingDir: string;
}

/**
 * Check if the project is a git repository
 */
function isGitRepo(projectPath: string): boolean {
  try {
    execSync("git rev-parse --git-dir", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 * @param projectPath - Starting directory to search from
 * @returns Absolute path to git root, or null if not in a git repo
 */
function getGitRoot(projectPath: string): string | null {
  try {
    const result = execSync("git rev-parse --show-toplevel", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Detect the composer.json file path
 * Searches in the project directory and its parents up to git root
 * Returns the absolute path to composer.json file
 */
async function detectComposerWorkingDir(
  config: WPTesterConfig,
  configPath?: string,
  gitRoot?: string
): Promise<string | null> {
  const projectPath = getProjectDir(config, configPath);

  // Try project path first
  try {
    const composerPath = join(projectPath, "composer.json");
    await access(composerPath);
    return composerPath;
  } catch {
    // composer.json not in project path, try parent directories
  }

  // Search parent directories up to git root
  let currentPath = projectPath;
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;

  while (depth < maxDepth) {
    const parentPath = dirname(currentPath);

    // Stop if we've reached the root or gone above git root
    if (parentPath === currentPath ||
        (gitRoot && !parentPath.startsWith(gitRoot))) {
      break;
    }

    try {
      const composerPath = join(parentPath, "composer.json");
      await access(composerPath);
      return composerPath;
    } catch {
      // Continue searching
    }

    currentPath = parentPath;
    depth++;
  }

  return null;
}

/**
 * Detect the default branch name from git
 */
function detectDefaultBranch(projectPath: string): string {
  try {
    // Try to get the default branch from remote HEAD
    const result = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // Result is like "refs/remotes/origin/main"
    const branch = result.split("/").pop();
    if (branch) {
      return branch;
    }
  } catch {
    // Remote HEAD not set, try other methods
  }

  try {
    // Check which common branch names exist locally
    const branches = execSync("git branch --list main master trunk", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse branch list and return first match
    const branchList = branches
      .split("\n")
      .map((b) => b.replace("*", "").trim())
      .filter((b) => b.length > 0);

    if (branchList.includes("main")) return "main";
    if (branchList.includes("master")) return "master";
    if (branchList.includes("trunk")) return "trunk";
  } catch {
    // Git command failed
  }

  // Default to "main"
  return "main";
}


/**
 * Extract configuration from existing workflow
 */
function extractConfigFromWorkflow(content: string): Partial<WorkflowConfig> {
  const config: Partial<WorkflowConfig> = {};

  // Extract workflow name
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    config.workflowName = nameMatch[1].trim();
  }

  // Extract branches
  const branchMatch = content.match(/branches:\s*\[([^\]]+)\]/);
  if (branchMatch) {
    config.branches = branchMatch[1]
      .split(",")
      .map((b) => b.trim().replace(/['"]/g, ""))
      .filter((b) => b.length > 0);
  }

  // Extract Node.js version
  const nodeMatch = content.match(/node-version:\s*['"]?(\d+)['"]?/);
  if (nodeMatch) {
    config.nodeVersion = nodeMatch[1];
  }

  // Check if caching is enabled
  config.enableCaching = content.includes("actions/cache@");

  // Check if composer install is enabled
  config.enableComposerInstall = content.includes("composer install");

  // Extract composer working directory
  const composerWorkingDirMatch = content.match(
    /composer install.*?\n\s*working-directory:\s*(.+)/,
  );
  if (composerWorkingDirMatch) {
    config.composerWorkingDir = composerWorkingDirMatch[1].trim();
  }

  // Extract wp-tester args (can be spread across multiple lines in YAML)
  const argsMatch = content.match(
    /npx\s+(?:@wp-tester\/cli|wp-tester)(?:@\S+)?\s+test\s*([\s\S]*?)(?:\$\{\{|working-directory:)/,
  );
  if (argsMatch && argsMatch[1]) {
    // Clean up captured text - collapse whitespace and remove newlines
    config.wpTesterArgs = argsMatch[1].replace(/\s+/g, ' ').trim();
  }

  return config;
}

/**
 * Generate the GitHub Action workflow content
 */
function generateWorkflowContent(config: WorkflowConfig): string {
  const {
    workflowName,
    branches,
    nodeVersion,
    enableCaching,
    wpTesterArgs,
    enableComposerInstall,
    composerWorkingDir,
  } = config;

  // Clean up args - split by whitespace for multi-line formatting
  const argsArray = wpTesterArgs
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);

  const branchList = branches.join(", ");

  const cacheStep = enableCaching
    ? `
      - name: Cache node modules
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: \${{ runner.os }}-node-\${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            \${{ runner.os }}-node-
`
    : "";

  const composerStep = enableComposerInstall
    ? `
      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist
        working-directory: ${composerWorkingDir}
`
    : "";

  // Add working directory to wp-tester step if composer is in a subdirectory
  const wpTesterWorkingDir =
    composerWorkingDir !== "."
      ? `\n        working-directory: ${composerWorkingDir}`
      : "";

  return `name: ${workflowName}

# WP Tester - WordPress Testing Workflow
# This workflow runs wp-tester to test your WordPress plugin/theme
#
# For more information, see: https://github.com/bgrgicak/wp-tester
#
# Configuration:
# - Branches: ${branchList}
# - Node.js: ${nodeVersion}
# - Caching: ${enableCaching ? "enabled" : "disabled"}
#
# To customize:
# - Add arguments like --test=phpunit or --failed-only
# - See 'npx wp-tester --help' for all available options

on:
  push:
    branches: [${branchList}]
  pull_request:
    branches: [${branchList}]
  workflow_dispatch:
    inputs:
      wp-tester-args:
        description: 'Additional arguments for wp-tester'
        required: false
        default: ''

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
${cacheStep}${composerStep}
      - name: Run WP Tester
        run: >
          npx @wp-tester/cli@latest test${argsArray.length > 0 ? `\n          ${argsArray.join("\n          ")}` : ""}
          \${{ github.event.inputs.wp-tester-args }}${wpTesterWorkingDir}
`;
}


/**
 * Display success message with workflow details
 */
function displaySuccessMessage(
  workflowPath: string,
  config: WorkflowConfig
): void {
  const relativePath = relative(process.cwd(), workflowPath) || workflowPath;
  const branchInfo =
    config.branches.length === 1
      ? `Triggers on push/PR to '${config.branches[0]}' branch`
      : `Triggers on: ${config.branches.join(", ")}`;

  const cacheInfo = config.enableCaching ? " with caching" : "";
  const composerInfo = config.enableComposerInstall
    ? `\nComposer dependencies will be installed from: ${config.composerWorkingDir}`
    : "";

  const message = `${pc.cyan(relativePath)}

${branchInfo}
Node.js ${config.nodeVersion}${cacheInfo}${composerInfo}
You can also trigger it manually from GitHub Actions.`;

  clack.note(message, pc.green("✓ GitHub Action created successfully!"));
}

/**
 * Display configuration help
 */
function displayConfigHelp(): void {
  const helpText = `
${pc.bold("wp-tester CLI Arguments")}

${pc.cyan("Common options:")}
  --test=<type>      Run specific tests: wp, plugin, theme, phpunit
  --passWithNoTests  Allow passing when no tests found

Press enter to run tests using default options.
`;

  clack.note(helpText, "Configuration Help");
}

/**
 * CI config option
 * Creates a GitHub Action workflow for running wp-tester
 */
export async function ciOption(
  config: WPTesterConfig,
  context?: { configPath?: string; skipPrompt?: boolean },
): Promise<WPTesterConfig> {
  const configPath = context?.configPath;
  const skipPrompt = context?.skipPrompt ?? false;
  const projectPath = getProjectDir(config, configPath);

  // Check if this is a git repository and get the git root
  if (!isGitRepo(projectPath)) {
    clack.log.warn(
      "This directory is not a git repository. GitHub Actions require git.",
    );
    const continueAnyway = await clack.confirm({
      message: "Continue anyway?",
      initialValue: false,
    });

    if (clack.isCancel(continueAnyway) || !continueAnyway) {
      return config;
    }
  }

  // If running during setup (not via direct command), ask if user wants to setup CI
  if (!skipPrompt) {
    const setupCI = await clack.confirm({
      message: "Do you want to setup CI?",
      initialValue: true,
    });

    if (clack.isCancel(setupCI) || !setupCI) {
      clack.log.info("Skipping CI setup.");
      return config;
    }
  }

  // Get the git root directory - this is where the workflow should be stored
  const gitRoot = getGitRoot(projectPath);
  const workflowBasePath = gitRoot || projectPath;

  // Default workflow path
  const defaultWorkflowPath = join(workflowBasePath, WORKFLOW_PATH);
  let customWorkflowPath: string | null = null;

  // Ask for workflow path
  const workflowPathInput = await clack.text({
    message: "GitHub Action workflow path",
    placeholder: defaultWorkflowPath,
    validate: (value) => {
      if (value && value.trim().length > 0) {
        // Check if path looks valid (basic validation)
        if (!value.includes(".yml") && !value.includes(".yaml")) {
          return "Workflow file should have .yml or .yaml extension";
        }
      }
      return undefined;
    },
  });

  if (clack.isCancel(workflowPathInput)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  // If empty, use default path
  if (!workflowPathInput || workflowPathInput.trim().length === 0) {
    customWorkflowPath = null;
  } else if (workflowPathInput !== defaultWorkflowPath) {
    // Store custom path if different from default
    customWorkflowPath = workflowPathInput;
  }

  const detectedComposerDir = await detectComposerWorkingDir(
    config,
    configPath,
    workflowBasePath,
  );
  const usesComposer = detectedComposerDir !== null;

  // Default configuration
  let workflowConfig: WorkflowConfig = {
    workflowName: "WP Tester",
    branches: [detectDefaultBranch(workflowBasePath)],
    nodeVersion: "20",
    enableCaching: true,
    wpTesterArgs: "",
    enableComposerInstall: usesComposer,
    composerWorkingDir: ".",
  };

  // Determine the actual workflow path to use
  const workflowPath = customWorkflowPath || defaultWorkflowPath;

  // Check if workflow already exists at the target path
  let exists = false;
  try {
    await access(workflowPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    let existingContent: string | null = null;
    try {
      existingContent = await readFile(workflowPath, "utf8");
    } catch {
      existingContent = null;
    }
    if (existingContent) {
      const extracted = extractConfigFromWorkflow(existingContent);
      workflowConfig = {
        ...workflowConfig,
        ...extracted,
        branches: extracted.branches || workflowConfig.branches,
        wpTesterArgs: extracted.wpTesterArgs || "",
      };
    }

    const overwrite = await clack.select({
      message: `${relative(process.cwd(), workflowPath) || workflowPath} already exists. What would you like to do?`,
      options: [
        {
          value: "edit",
          label: "Edit configuration",
          hint: "Modify settings (preserves detected values)",
        },
        {
          value: "overwrite",
          label: "Overwrite with defaults",
          hint: "Start fresh with default configuration",
        },
        { value: "skip", label: "Keep existing", hint: "Don't make changes" },
      ],
      initialValue: "edit",
    });

    if (clack.isCancel(overwrite)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (overwrite === "skip") {
      clack.log.info("Keeping existing workflow file.");
      return config;
    }

    if (overwrite === "overwrite") {
      workflowConfig = {
        ...workflowConfig,
        workflowName: "WP Tester",
        branches: [detectDefaultBranch(workflowBasePath)],
        nodeVersion: "20",
        enableCaching: true,
        wpTesterArgs: "",
        composerWorkingDir: ".",
      };
    }
  }

  // Configure workflow name
  const workflowName = await clack.text({
    message: "Workflow name:",
    initialValue: workflowConfig.workflowName,
    placeholder: "WP Tester",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Workflow name is required";
      }
      return undefined;
    },
  });

  if (clack.isCancel(workflowName)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  workflowConfig.workflowName = workflowName.trim();

  // Configure branches
  const branchInput = await clack.text({
    message: "Target branches for CI triggers (comma-separated):",
    initialValue: workflowConfig.branches.join(", "),
    placeholder: "main, develop",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "At least one branch is required";
      }
      return undefined;
    },
  });

  if (clack.isCancel(branchInput)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  workflowConfig.branches = branchInput
    .split(",")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  // Configure Node.js version
  const nodeVersion = await clack.select({
    message: "Node.js version:",
    options: [
      { value: "22", label: "22 (Latest LTS)", hint: "Recommended" },
      { value: "20", label: "20 (LTS)" },
      { value: "18", label: "18 (Maintenance LTS)" },
    ],
    initialValue: workflowConfig.nodeVersion,
  });

  if (clack.isCancel(nodeVersion)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  workflowConfig.nodeVersion = nodeVersion;

  // Configure caching
  const enableCaching = await clack.confirm({
    message: "Enable npm caching for faster builds?",
    initialValue: workflowConfig.enableCaching,
  });

  if (clack.isCancel(enableCaching)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  workflowConfig.enableCaching = enableCaching;

  // Check if Composer is used
  if (usesComposer) {
    const enableComposerInstall = await clack.confirm({
      message: "Install Composer dependencies before running tests?",
      initialValue: workflowConfig.enableComposerInstall,
    });

    if (clack.isCancel(enableComposerInstall)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (enableComposerInstall) {
      workflowConfig.enableComposerInstall = true;

      // Calculate the initial value - reconstruct full path from stored config or use detected path
      const initialComposerPath =
        workflowConfig.composerWorkingDir !== "."
          ? join(
              workflowBasePath,
              workflowConfig.composerWorkingDir,
              "composer.json",
            )
          : detectedComposerDir;

      // Always ask for the composer.json file path, with the detected path as default
      const composerJsonPath = await clack.text({
        message: "Path to composer.json file:",
        initialValue: initialComposerPath || detectedComposerDir || "",
        placeholder: `Detected: ${detectedComposerDir}`,
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return "Path to composer.json is required";
          }
          if (!value.endsWith("composer.json")) {
            return "Path must end with composer.json";
          }
          return undefined;
        },
      });

      if (clack.isCancel(composerJsonPath)) {
        clack.cancel("Setup cancelled.");
        process.exit(0);
      }

      // Extract the directory from the composer.json path for the workflow
      const composerDir = dirname(composerJsonPath.trim());
      // Calculate relative path from git root
      workflowConfig.composerWorkingDir =
        relative(workflowBasePath, composerDir) || ".";
    } else {
      workflowConfig.enableComposerInstall = false;
    }
  }

  // Show help for wp-tester arguments
  displayConfigHelp();

  // Configure wp-tester arguments
  const argsInput = await clack.text({
    message: "wp-tester arguments (press Enter for defaults):",
    placeholder: "e.g., --test=phpunit --failed-only",
    initialValue: workflowConfig.wpTesterArgs,
  });

  if (clack.isCancel(argsInput)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  workflowConfig.wpTesterArgs =
    typeof argsInput === "string" ? argsInput.trim() : "";

  // Generate workflow content
  const workflowContent = generateWorkflowContent(workflowConfig);

  // Show preview
  clack.note(pc.dim(workflowContent), "Workflow Preview");

  // Confirm creation
  const confirmCreate = await clack.confirm({
    message: "Create this workflow?",
    initialValue: true,
  });

  if (clack.isCancel(confirmCreate) || !confirmCreate) {
    clack.log.info("Workflow creation cancelled.");
    return config;
  }

  // Create directory and file with spinner
  const workflowDir = dirname(workflowPath);

  const spinner = clack.spinner();
  spinner.start("Creating workflow file...");

  try {
    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowPath, workflowContent, "utf8");
    spinner.stop("Workflow file created!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    spinner.stop("Failed to create workflow file");
    clack.log.error(`Error: ${message}`);
    process.exit(1);
  }

  // Display success message
  displaySuccessMessage(workflowPath, workflowConfig);

  return config;
}
