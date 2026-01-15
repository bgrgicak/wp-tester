import { describe, it, expect } from "vitest";
import { hostToVfs, vfsToHost } from "../src/path-mappers";
import type { ResolvedWPTesterConfig } from "../src/resolved-types";

describe("Path Mappers", () => {
  const mockPluginConfig: ResolvedWPTesterConfig = {
    projectHostPath: "/Users/test/my-plugin",
    projectVFSPath: "/wordpress/wp-content/plugins/my-plugin",
    projectType: "plugin",
    environments: [],
    tests: {},
    reporters: {},
  };

  const mockThemeConfig: ResolvedWPTesterConfig = {
    projectHostPath: "/Users/test/my-theme",
    projectVFSPath: "/wordpress/wp-content/themes/my-theme",
    projectType: "theme",
    environments: [],
    tests: {},
    reporters: {},
  };

  describe("hostToVfs", () => {
    it("should map host root to VFS root", () => {
      const result = hostToVfs("/Users/test/my-plugin", mockPluginConfig);
      expect(result).toBe("/wordpress/wp-content/plugins/my-plugin");
    });

    it("should map host subdirectory to VFS subdirectory", () => {
      const result = hostToVfs("/Users/test/my-plugin/tests/bootstrap.php", mockPluginConfig);
      expect(result).toBe("/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php");
    });

    it("should map nested paths correctly", () => {
      const result = hostToVfs("/Users/test/my-plugin/src/admin/views/settings.php", mockPluginConfig);
      expect(result).toBe("/wordpress/wp-content/plugins/my-plugin/src/admin/views/settings.php");
    });

    it("should work with theme config", () => {
      const result = hostToVfs("/Users/test/my-theme/functions.php", mockThemeConfig);
      expect(result).toBe("/wordpress/wp-content/themes/my-theme/functions.php");
    });

    it("should handle config files", () => {
      const result = hostToVfs("/Users/test/my-plugin/phpunit.xml", mockPluginConfig);
      expect(result).toBe("/wordpress/wp-content/plugins/my-plugin/phpunit.xml");
    });
  });

  describe("vfsToHost", () => {
    it("should map VFS root to host root", () => {
      const result = vfsToHost("/wordpress/wp-content/plugins/my-plugin", mockPluginConfig);
      expect(result).toBe("/Users/test/my-plugin");
    });

    it("should map VFS subdirectory to host subdirectory", () => {
      const result = vfsToHost("/wordpress/wp-content/plugins/my-plugin/tests/bootstrap.php", mockPluginConfig);
      expect(result).toBe("/Users/test/my-plugin/tests/bootstrap.php");
    });

    it("should map nested paths correctly", () => {
      const result = vfsToHost("/wordpress/wp-content/plugins/my-plugin/src/admin/views/settings.php", mockPluginConfig);
      expect(result).toBe("/Users/test/my-plugin/src/admin/views/settings.php");
    });

    it("should work with theme config", () => {
      const result = vfsToHost("/wordpress/wp-content/themes/my-theme/functions.php", mockThemeConfig);
      expect(result).toBe("/Users/test/my-theme/functions.php");
    });

    it("should handle config files", () => {
      const result = vfsToHost("/wordpress/wp-content/plugins/my-plugin/phpunit.xml", mockPluginConfig);
      expect(result).toBe("/Users/test/my-plugin/phpunit.xml");
    });
  });

  describe("Round-trip conversions", () => {
    it("should convert host -> VFS -> host correctly", () => {
      const hostPath = "/Users/test/my-plugin/tests/Unit/ExampleTest.php";
      const vfsPath = hostToVfs(hostPath, mockPluginConfig);
      const backToHost = vfsToHost(vfsPath, mockPluginConfig);
      expect(backToHost).toBe(hostPath);
    });

    it("should convert VFS -> host -> VFS correctly", () => {
      const vfsPath = "/wordpress/wp-content/plugins/my-plugin/tests/Unit/ExampleTest.php";
      const hostPath = vfsToHost(vfsPath, mockPluginConfig);
      const backToVfs = hostToVfs(hostPath, mockPluginConfig);
      expect(backToVfs).toBe(vfsPath);
    });
  });
});
