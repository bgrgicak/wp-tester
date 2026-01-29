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
  branches: string[];
  nodeVersion: string;
  enableCaching: boolean;
  wpTesterArgs: string;
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
 * Detect GitHub repository info for badge generation
 */
function detectGitHubRepo(projectPath: string): string | null {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse GitHub URL (supports both HTTPS and SSH formats)
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/
    );
    const sshMatch = remoteUrl.match(/github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);

    if (httpsMatch) return httpsMatch[1];
    if (sshMatch) return sshMatch[1];
  } catch {
    // Git command failed
  }
  return null;
}

/**
 * Extract configuration from existing workflow
 */
function extractConfigFromWorkflow(content: string): Partial<WorkflowConfig> {
  const config: Partial<WorkflowConfig> = {};

  // Extract branches
  const branchMatch = content.match(
    /branches:\s*\[([^\]]+)\]/
  );
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

  // Extract wp-tester args
  const argsMatch = content.match(
    /npx\s+wp-tester(?:@\S+)?\s+test\s*(.*?)(?:\s*\$\{\{|$)/m
  );
  if (argsMatch && argsMatch[1]) {
    config.wpTesterArgs = argsMatch[1].trim();
  }

  return config;
}

/**
 * Generate the GitHub Action workflow content
 */
function generateWorkflowContent(config: WorkflowConfig): string {
  const { branches, nodeVersion, enableCaching, wpTesterArgs } = config;

  // Clean up args - remove empty lines and trim
  const cleanArgs = wpTesterArgs
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");

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

  return `# WP Tester - WordPress Testing Workflow
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

name: WP Tester

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
    name: Run WordPress Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
${cacheStep}
      - name: Run WP Tester
        run: npx wp-tester@latest test${cleanArgs ? ` ${cleanArgs}` : ""} \${{ github.event.inputs.wp-tester-args }}
`;
}

/**
 * Generate README badge markdown
 */
function generateBadgeMarkdown(repoPath: string): string {
  return `[![WP Tester](https://github.com/${repoPath}/actions/workflows/wp-tester.yml/badge.svg)](https://github.com/${repoPath}/actions/workflows/wp-tester.yml)`;
}

/**
 * Check if workflow file already exists
 */
async function workflowExists(projectPath: string): Promise<boolean> {
  try {
    await access(join(projectPath, WORKFLOW_PATH));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read existing workflow file
 */
async function readExistingWorkflow(
  projectPath: string
): Promise<string | null> {
  try {
    const content = await readFile(join(projectPath, WORKFLOW_PATH), "utf8");
    return content;
  } catch {
    return null;
  }
}

/**
 * Display workflow preview
 */
function displayWorkflowPreview(content: string): void {
  const lines = content.split("\n").slice(0, 25);
  const preview = lines.join("\n") + (content.split("\n").length > 25 ? "\n..." : "");

  clack.note(pc.dim(preview), "Workflow Preview");
}

/**
 * Display success message with workflow details and optional badge
 */
function displaySuccessMessage(
  workflowPath: string,
  config: WorkflowConfig,
  badgeMarkdown?: string
): void {
  const relativePath = relative(process.cwd(), workflowPath) || workflowPath;
  const branchInfo =
    config.branches.length === 1
      ? `Triggers on push/PR to '${config.branches[0]}' branch`
      : `Triggers on: ${config.branches.join(", ")}`;

  const cacheInfo = config.enableCaching ? " with caching" : "";

  let message = `${pc.cyan(relativePath)}

${branchInfo}
Node.js ${config.nodeVersion}${cacheInfo}
You can also trigger it manually from GitHub Actions.`;

  if (badgeMarkdown) {
    message += `

${pc.bold("README Badge:")}
${pc.dim(badgeMarkdown)}`;
  }

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
  context?: { configPath?: string; skipPrompt?: boolean }
): Promise<WPTesterConfig> {
  const configPath = context?.configPath;
  const skipPrompt = context?.skipPrompt ?? false;
  const projectPath = getProjectDir(config, configPath);

  // Check if this is a git repository
  if (!isGitRepo(projectPath)) {
    clack.log.warn(
      "This directory is not a git repository. GitHub Actions require git."
    );
    const continueAnyway = await clack.confirm({
      message: "Continue anyway?",
      initialValue: false,
    });

    if (clack.isCancel(continueAnyway) || !continueAnyway) {
      return config;
    }
  }

  // Check if user wants to set up CI
  if (!skipPrompt) {
    const setupCI = await clack.select({
      message:
        "Would you like to create a GitHub Action for automated testing?",
      options: [
        {
          value: true,
          label: "Yes",
          hint: "Create .github/workflows/wp-tester.yml",
        },
        { value: false, label: "No", hint: "Skip CI setup" },
      ],
      initialValue: true,
    });

    if (clack.isCancel(setupCI)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (!setupCI) {
      return config;
    }
  }

  // Default configuration
  let workflowConfig: WorkflowConfig = {
    branches: [detectDefaultBranch(projectPath)],
    nodeVersion: "20",
    enableCaching: true,
    wpTesterArgs: "",
  };

  // Check if workflow already exists
  const exists = await workflowExists(projectPath);

  if (exists) {
    const existingContent = await readExistingWorkflow(projectPath);
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
      message: `${WORKFLOW_PATH} already exists. What would you like to do?`,
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
        branches: [detectDefaultBranch(projectPath)],
        nodeVersion: "20",
        enableCaching: true,
        wpTesterArgs: "",
      };
    }
  }

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
  displayWorkflowPreview(workflowContent);

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
  const workflowFullPath = join(projectPath, WORKFLOW_PATH);
  const workflowDir = dirname(workflowFullPath);

  const spinner = clack.spinner();
  spinner.start("Creating workflow file...");

  try {
    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowFullPath, workflowContent, "utf8");
    spinner.stop("Workflow file created!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    spinner.stop("Failed to create workflow file");
    clack.log.error(`Error: ${message}`);
    process.exit(1);
  }

  // Offer to show badge
  const repoPath = detectGitHubRepo(projectPath);
  let badgeMarkdown: string | undefined;

  if (repoPath) {
    const addBadge = await clack.confirm({
      message: "Would you like a README badge for the workflow status?",
      initialValue: true,
    });

    if (!clack.isCancel(addBadge) && addBadge) {
      badgeMarkdown = generateBadgeMarkdown(repoPath);
    }
  }

  // Display success message
  displaySuccessMessage(workflowFullPath, workflowConfig, badgeMarkdown);

  return config;
}
