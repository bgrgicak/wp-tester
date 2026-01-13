import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/config";
import type { WPTesterConfig } from "../src/wp-tester-config";

describe("Resolved Config - preferredVersions", () => {
  it("should set default preferredVersions when not provided", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: {},
        },
      ],
      tests: {},
    };

    const resolved = await resolveConfig(config);

    expect(resolved.environments[0].blueprint.preferredVersions).toBeDefined();
    expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("latest");
    expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("latest");
  });

  it("should preserve provided preferredVersions", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: {
            preferredVersions: {
              php: "8.2",
              wp: "6.4",
            },
          },
        },
      ],
      tests: {},
    };

    const resolved = await resolveConfig(config);

    expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.2");
    expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.4");
  });

  it("should set default for missing php version", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "6.4",
            },
          },
        },
      ],
      tests: {},
    };

    const resolved = await resolveConfig(config);

    expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("latest");
    expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("6.4");
  });

  it("should set default for missing wp version", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: {
            preferredVersions: {
              php: "8.2",
              wp: "latest",
            },
          },
        },
      ],
      tests: {},
    };

    const resolved = await resolveConfig(config);

    expect(resolved.environments[0].blueprint.preferredVersions.php).toBe("8.2");
    expect(resolved.environments[0].blueprint.preferredVersions.wp).toBe("latest");
  });

  it("should handle multiple environments with mixed preferredVersions", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Environment 1",
          blueprint: {
            preferredVersions: {
              php: "8.2",
              wp: "6.4",
            },
          },
        },
        {
          name: "Environment 2",
          blueprint: {},
        },
        {
          name: "Environment 3",
          blueprint: {
            preferredVersions: {
              php: "8.3",
              wp: "latest",
            },
          },
        },
      ],
      tests: {},
    };

    const resolved = await resolveConfig(config);

    expect(resolved.environments[0].blueprint.preferredVersions).toEqual({
      php: "8.2",
      wp: "6.4",
    });
    expect(resolved.environments[1].blueprint.preferredVersions).toEqual({
      php: "latest",
      wp: "latest",
    });
    expect(resolved.environments[2].blueprint.preferredVersions).toEqual({
      php: "8.3",
      wp: "latest",
    });
  });
});
