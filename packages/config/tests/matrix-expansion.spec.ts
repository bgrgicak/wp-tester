import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/config";
import type { WPTesterConfig } from "../src/wp-tester-config";

describe("Matrix Expansion - Environment Version Arrays", () => {
  describe("Single version strings (no expansion)", () => {
    it("should handle single php version string", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: "8.2",
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.2");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("latest");
    });

    it("should handle single wp version string", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            wp: "6.7",
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("latest");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.7");
    });

    it("should handle single php and wp version strings", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: "8.2",
            wp: "6.7",
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.2");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.7");
    });
  });

  describe("PHP version array expansion", () => {
    it("should expand environment with php version array", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: ["8.1", "8.2", "8.3"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(3);
      expect(resolved.environments[0].name).toBe("Test (PHP 8.1)");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.1");
      expect(resolved.environments[1].name).toBe("Test (PHP 8.2)");
      expect(resolved.environments[1].blueprint.preferredVersions.php).toBe("8.2");
      expect(resolved.environments[2].name).toBe("Test (PHP 8.3)");
      expect(resolved.environments[2].blueprint.preferredVersions.php).toBe("8.3");
    });

    it("should expand environment without base name", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            php: ["8.1", "8.2"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].name).toBe("PHP 8.1");
      expect(resolved.environments[1].name).toBe("PHP 8.2");
    });
  });

  describe("WP version array expansion", () => {
    it("should expand environment with wp version array", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            wp: ["6.6", "6.7"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].name).toBe("Test (WP 6.6)");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.6");
      expect(resolved.environments[1].name).toBe("Test (WP 6.7)");
      expect(resolved.environments[1].blueprint.preferredVersions.wp).toBe("6.7");
    });
  });

  describe("Full matrix expansion (PHP x WP)", () => {
    it("should create full matrix for php and wp arrays", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Matrix Test",
            php: ["8.1", "8.2"],
            wp: ["6.6", "6.7"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(4);

      // Check all 4 combinations
      expect(resolved.environments[0].name).toBe("Matrix Test (PHP 8.1, WP 6.6)");
      expect(resolved.environments[0].blueprint.preferredVersions).toEqual({
        php: "8.1",
        wp: "6.6",
      });

      expect(resolved.environments[1].name).toBe("Matrix Test (PHP 8.1, WP 6.7)");
      expect(resolved.environments[1].blueprint.preferredVersions).toEqual({
        php: "8.1",
        wp: "6.7",
      });

      expect(resolved.environments[2].name).toBe("Matrix Test (PHP 8.2, WP 6.6)");
      expect(resolved.environments[2].blueprint.preferredVersions).toEqual({
        php: "8.2",
        wp: "6.6",
      });

      expect(resolved.environments[3].name).toBe("Matrix Test (PHP 8.2, WP 6.7)");
      expect(resolved.environments[3].blueprint.preferredVersions).toEqual({
        php: "8.2",
        wp: "6.7",
      });
    });

    it("should handle larger matrix", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            php: ["8.1", "8.2", "8.3"],
            wp: ["6.5", "6.6", "6.7"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // 3 PHP versions x 3 WP versions = 9 environments
      expect(resolved.environments).toHaveLength(9);
    });
  });

  describe("Blueprint preferredVersions override", () => {
    it("should use blueprint php version instead of environment php array", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: ["8.1", "8.2", "8.3"],
            blueprint: {
              preferredVersions: {
                php: "8.0",
              },
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Blueprint overrides, so only 1 environment
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.0");
    });

    it("should use blueprint wp version instead of environment wp array", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            wp: ["6.6", "6.7"],
            blueprint: {
              preferredVersions: {
                wp: "6.5",
              },
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Blueprint overrides, so only 1 environment
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.5");
    });

    it("should partially override when only one version is in blueprint", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: ["8.1", "8.2"],
            wp: ["6.6", "6.7"],
            blueprint: {
              preferredVersions: {
                php: "8.0",
                // wp not specified, so wp array should be used
              },
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Blueprint php overrides (1), but wp array expands (2)
      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].name).toBe("Test (WP 6.6)");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.0");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.6");

      expect(resolved.environments[1].name).toBe("Test (WP 6.7)");
      expect(resolved.environments[1].blueprint.preferredVersions.php).toBe("8.0");
      expect(resolved.environments[1].blueprint.preferredVersions.wp).toBe("6.7");
    });

    it("should not expand when both blueprint versions are set", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: ["8.1", "8.2"],
            wp: ["6.6", "6.7"],
            blueprint: {
              preferredVersions: {
                php: "8.0",
                wp: "6.5",
              },
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Both blueprint versions override, so only 1 environment
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions).toEqual({
        php: "8.0",
        wp: "6.5",
      });
    });
  });

  describe("Multiple environments", () => {
    it("should expand each environment independently", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Env1",
            php: ["8.1", "8.2"],
            blueprint: {},
          },
          {
            name: "Env2",
            wp: ["6.6", "6.7"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(4);

      // First environment expands to 2
      expect(resolved.environments[0].name).toBe("Env1 (PHP 8.1)");
      expect(resolved.environments[1].name).toBe("Env1 (PHP 8.2)");

      // Second environment expands to 2
      expect(resolved.environments[2].name).toBe("Env2 (WP 6.6)");
      expect(resolved.environments[3].name).toBe("Env2 (WP 6.7)");
    });

    it("should handle mix of expanded and non-expanded environments", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Matrix",
            php: ["8.1", "8.2"],
            wp: ["6.6", "6.7"],
            blueprint: {},
          },
          {
            name: "Single",
            blueprint: {
              preferredVersions: {
                php: "8.3",
                wp: "6.8",
              },
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(5);

      // First environment expands to 4
      expect(resolved.environments[0].name).toBe("Matrix (PHP 8.1, WP 6.6)");
      expect(resolved.environments[1].name).toBe("Matrix (PHP 8.1, WP 6.7)");
      expect(resolved.environments[2].name).toBe("Matrix (PHP 8.2, WP 6.6)");
      expect(resolved.environments[3].name).toBe("Matrix (PHP 8.2, WP 6.7)");

      // Second environment stays as 1
      expect(resolved.environments[4].name).toBe("Single");
      expect(resolved.environments[4].blueprint.preferredVersions).toEqual({
        php: "8.3",
        wp: "6.8",
      });
    });
  });

  describe("Environment properties preservation", () => {
    it("should preserve mounts in expanded environments", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            php: ["8.1", "8.2"],
            blueprint: {},
            mounts: [
              {
                hostPath: "/test/path",
                vfsPath: "/wordpress/wp-content/plugins/test",
              },
            ],
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].mounts).toHaveLength(1);
      expect(resolved.environments[0].mounts[0].vfsPath).toBe("/wordpress/wp-content/plugins/test");
      expect(resolved.environments[1].mounts).toHaveLength(1);
      expect(resolved.environments[1].mounts[0].vfsPath).toBe("/wordpress/wp-content/plugins/test");
    });

    it("should preserve env variables in expanded environments", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            php: ["8.1", "8.2"],
            blueprint: {},
            env: {
              WP_DEBUG: "1",
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].env).toEqual({ WP_DEBUG: "1" });
      expect(resolved.environments[1].env).toEqual({ WP_DEBUG: "1" });
    });

    it("should preserve blueprint steps in expanded environments", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            php: ["8.1", "8.2"],
            blueprint: {
              steps: [
                {
                  step: "activatePlugin",
                  pluginPath: "test-plugin/test-plugin.php",
                },
              ],
            },
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      expect(resolved.environments).toHaveLength(2);
      expect(resolved.environments[0].blueprint.steps).toHaveLength(1);
      expect(resolved.environments[1].blueprint.steps).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty version arrays", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: [],
            wp: [],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Empty arrays should result in no expansion
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("latest");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("latest");
    });

    it("should handle single-element arrays without matrix naming", async () => {
      const config: WPTesterConfig = {
        environments: [
          {
            name: "Test",
            php: ["8.2"],
            wp: ["6.7"],
            blueprint: {},
          },
        ],
        tests: {},
      };

      const resolved = await resolveConfig(config);

      // Single-element arrays should not trigger matrix naming
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe("Test");
      expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.2");
      expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.7");
    });
  });
});
