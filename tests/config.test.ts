import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseNtfyBackendConfig } from "../src/config.js";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8")
);
const VERSION: string = pkg.version;

describe("parseNtfyBackendConfig", () => {
  it("should throw when topic is missing", () => {
    expect(() => parseNtfyBackendConfig({})).toThrow("topic");
  });

  it("should throw when topic is empty string", () => {
    expect(() => parseNtfyBackendConfig({ topic: "" })).toThrow("topic");
  });

  it("should throw when topic is not a string", () => {
    expect(() => parseNtfyBackendConfig({ topic: 123 })).toThrow("topic");
  });

  it("should return config with valid topic", () => {
    const config = parseNtfyBackendConfig({ topic: "my-topic" });
    expect(config.topic).toBe("my-topic");
  });

  it("should default server to https://ntfy.sh", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.server).toBe("https://ntfy.sh");
  });

  it("should use custom server when provided", () => {
    const config = parseNtfyBackendConfig({ topic: "test", server: "https://custom.ntfy.sh" });
    expect(config.server).toBe("https://custom.ntfy.sh");
  });

  it("should default token to undefined", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.token).toBeUndefined();
  });

  it("should use custom token when provided", () => {
    const config = parseNtfyBackendConfig({ topic: "test", token: "my-secret-token" });
    expect(config.token).toBe("my-secret-token");
  });

  it("should default priority to 'default'", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.priority).toBe("default");
  });

  it("should accept valid priority values", () => {
    for (const p of ["min", "low", "default", "high", "max"]) {
      const config = parseNtfyBackendConfig({ topic: "test", priority: p });
      expect(config.priority).toBe(p);
    }
  });

  it("should throw when priority is invalid", () => {
    expect(() => parseNtfyBackendConfig({ topic: "test", priority: "invalid" })).toThrow(
      "priority"
    );
  });

  it("should default iconUrl to dark mode GitHub raw URL using package version", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should use light mode icon URL when icon.mode is light", () => {
    const config = parseNtfyBackendConfig({ topic: "test", icon: { mode: "light" } });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-light.png`
    );
  });

  it("should use dark mode icon URL when icon.mode is dark", () => {
    const config = parseNtfyBackendConfig({ topic: "test", icon: { mode: "dark" } });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should default to dark mode when icon.mode is an invalid value", () => {
    const config = parseNtfyBackendConfig({ topic: "test", icon: { mode: "neon" } });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should use icon.variant.dark override when mode is dark", () => {
    const config = parseNtfyBackendConfig({
      topic: "test",
      icon: { variant: { dark: "https://example.com/my-dark-icon.png" } },
    });
    expect(config.iconUrl).toBe("https://example.com/my-dark-icon.png");
  });

  it("should use icon.variant.light override when mode is light", () => {
    const config = parseNtfyBackendConfig({
      topic: "test",
      icon: {
        mode: "light",
        variant: { light: "https://example.com/my-light-icon.png" },
      },
    });
    expect(config.iconUrl).toBe("https://example.com/my-light-icon.png");
  });

  it("should ignore icon.variant.light when mode is dark", () => {
    const config = parseNtfyBackendConfig({
      topic: "test",
      icon: {
        mode: "dark",
        variant: { light: "https://example.com/my-light-icon.png" },
      },
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should ignore icon.variant.dark when mode is light", () => {
    const config = parseNtfyBackendConfig({
      topic: "test",
      icon: {
        mode: "light",
        variant: { dark: "https://example.com/my-dark-icon.png" },
      },
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-light.png`
    );
  });

  it("should default fetchTimeout to undefined", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.fetchTimeout).toBeUndefined();
  });

  it("should parse fetchTimeout from ISO 8601 duration string to milliseconds", () => {
    const config = parseNtfyBackendConfig({ topic: "test", fetchTimeout: "PT10S" });
    expect(config.fetchTimeout).toBe(10000);
  });

  it("should throw for invalid fetchTimeout value", () => {
    expect(() =>
      parseNtfyBackendConfig({ topic: "test", fetchTimeout: "invalid" })
    ).toThrow("Invalid ISO 8601 duration");
  });

  it("should default click to undefined", () => {
    const config = parseNtfyBackendConfig({ topic: "test" });
    expect(config.click).toBeUndefined();
  });

  it("should parse a custom click URL template", () => {
    const config = parseNtfyBackendConfig({
      topic: "test",
      click: "opencode://session/{session_id}",
    });
    expect(config.click).toBe("opencode://session/{session_id}");
  });

  it("should allow an empty click URL to disable the tap action", () => {
    const config = parseNtfyBackendConfig({ topic: "test", click: "" });
    expect(config.click).toBe("");
  });

  it("should throw when click is not a string", () => {
    expect(() =>
      parseNtfyBackendConfig({ topic: "test", click: 123 })
    ).toThrow("click");
  });

  describe("title templates", () => {
    it("should parse a value template for session.idle", () => {
      const config = parseNtfyBackendConfig({
        topic: "test",
        title: { "session.idle": { value: "{project}: Agent Idle" } },
      });
      expect(config.title).toEqual({
        "session.idle": { value: "{project}: Agent Idle" },
      });
    });

    it("should parse a command template for session.error", () => {
      const config = parseNtfyBackendConfig({
        topic: "test",
        title: { "session.error": { command: "echo Error in {project}" } },
      });
      expect(config.title).toEqual({
        "session.error": { command: "echo Error in {project}" },
      });
    });

    it("should parse multiple event types", () => {
      const config = parseNtfyBackendConfig({
        topic: "test",
        title: {
          "session.idle": { value: "Idle" },
          "session.error": { command: "echo Error" },
          "permission.asked": { value: "Permission" },
        },
      });
      expect(config.title).toEqual({
        "session.idle": { value: "Idle" },
        "session.error": { command: "echo Error" },
        "permission.asked": { value: "Permission" },
      });
    });

    it("should default title to undefined when not provided", () => {
      const config = parseNtfyBackendConfig({ topic: "test" });
      expect(config.title).toBeUndefined();
    });

    it("should throw when both value and command are specified", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          title: {
            "session.idle": { value: "Idle", command: "echo Idle" },
          },
        })
      ).toThrow();
    });

    it("should throw when neither value nor command is specified", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          title: { "session.idle": {} },
        })
      ).toThrow();
    });

    it("should throw when an invalid event type key is used", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          title: { "invalid.event": { value: "test" } },
        })
      ).toThrow();
    });
  });

  describe("message templates", () => {
    it("should parse a value template for session.idle", () => {
      const config = parseNtfyBackendConfig({
        topic: "test",
        message: { "session.idle": { value: "Agent is idle in {project}" } },
      });
      expect(config.message).toEqual({
        "session.idle": { value: "Agent is idle in {project}" },
      });
    });

    it("should parse a command template for session.error", () => {
      const config = parseNtfyBackendConfig({
        topic: "test",
        message: {
          "session.error": { command: "echo Error: {error}" },
        },
      });
      expect(config.message).toEqual({
        "session.error": { command: "echo Error: {error}" },
      });
    });

    it("should default message to undefined when not provided", () => {
      const config = parseNtfyBackendConfig({ topic: "test" });
      expect(config.message).toBeUndefined();
    });

    it("should throw when both value and command are specified for message", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          message: {
            "session.idle": { value: "Idle", command: "echo Idle" },
          },
        })
      ).toThrow();
    });

    it("should throw when neither value nor command is specified for message", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          message: { "session.idle": {} },
        })
      ).toThrow();
    });

    it("should throw when an invalid event type key is used for message", () => {
      expect(() =>
        parseNtfyBackendConfig({
          topic: "test",
          message: { "bad.event": { value: "test" } },
        })
      ).toThrow();
    });
  });
});

describe("JSON Schema", () => {
  it("should have a valid JSON Schema file at notification-ntfy.schema.json", () => {
    const schemaPath = join(
      import.meta.dirname,
      "..",
      "notification-ntfy.schema.json"
    );
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(schema.$schema).toContain("json-schema.org");
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
  });

  it("should define SDK-level and backend properties in the schema", () => {
    const schemaPath = join(
      import.meta.dirname,
      "..",
      "notification-ntfy.schema.json"
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const properties = Object.keys(schema.properties);
    // SDK-level properties
    expect(properties).toContain("$schema");
    expect(properties).toContain("enabled");
    expect(properties).toContain("events");
    // ntfy-specific backend properties
    expect(properties).toContain("backend");
    const backendProps = Object.keys(schema.properties.backend.properties);
    expect(backendProps).toContain("topic");
    expect(backendProps).toContain("server");
    expect(backendProps).toContain("token");
    expect(backendProps).toContain("priority");
    expect(backendProps).toContain("icon");
    expect(backendProps).toContain("fetchTimeout");
    expect(backendProps).toContain("click");
    expect(backendProps).toContain("title");
    expect(backendProps).toContain("message");
  });

  it("should define title and message as objects with event type properties using oneOf", () => {
    const schemaPath = join(
      import.meta.dirname,
      "..",
      "notification-ntfy.schema.json"
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const titleSchema = schema.properties.backend.properties.title;
    const messageSchema = schema.properties.backend.properties.message;

    // Both should be objects
    expect(titleSchema.type).toBe("object");
    expect(messageSchema.type).toBe("object");

    // Both should define properties for each event type
    const titleProps = Object.keys(titleSchema.properties);
    expect(titleProps).toContain("session.idle");
    expect(titleProps).toContain("session.error");
    expect(titleProps).toContain("permission.asked");

    const messageProps = Object.keys(messageSchema.properties);
    expect(messageProps).toContain("session.idle");
    expect(messageProps).toContain("session.error");
    expect(messageProps).toContain("permission.asked");

    // Each event type property should reference contentTemplate which uses oneOf
    const idleTitleRef = titleSchema.properties["session.idle"].$ref;
    expect(idleTitleRef).toBe("#/$defs/contentTemplate");

    // The contentTemplate def should use oneOf with value or command
    const contentTemplateDef = schema.$defs.contentTemplate;
    expect(contentTemplateDef.oneOf).toBeDefined();
    expect(contentTemplateDef.oneOf.length).toBe(2);
  });

  it("should require topic within backend when backend is present", () => {
    const schemaPath = join(
      import.meta.dirname,
      "..",
      "notification-ntfy.schema.json"
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(schema.properties.backend.required).toContain("topic");
  });

  it("should be listed in package.json files array", () => {
    const pkgPath = join(import.meta.dirname, "..", "package.json");
    const pkgContent = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkgContent.files).toContain("notification-ntfy.schema.json");
  });
});
