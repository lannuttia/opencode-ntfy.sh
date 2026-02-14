import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8")
);
const VERSION = pkg.version;

describe("loadConfig", () => {
  it("should return a config object with the topic when OPENCODE_NTFY_TOPIC is set", () => {
    const env = { OPENCODE_NTFY_TOPIC: "my-topic" };
    const config = loadConfig(env);
    expect(config.topic).toBe("my-topic");
  });

  it("should throw an error when OPENCODE_NTFY_TOPIC is not set", () => {
    expect(() => loadConfig({})).toThrow("OPENCODE_NTFY_TOPIC");
  });

  it("should not read topic from the old NTFY_TOPIC env var", () => {
    expect(() => loadConfig({ NTFY_TOPIC: "old-topic" })).toThrow(
      "OPENCODE_NTFY_TOPIC"
    );
  });

  it("should use default server and priority when not specified", () => {
    const config = loadConfig({ OPENCODE_NTFY_TOPIC: "test" });
    expect(config.server).toBe("https://ntfy.sh");
    expect(config.priority).toBe("default");
    expect(config.token).toBeUndefined();
  });

  it("should use custom server, token, and priority from env", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_SERVER: "https://custom.ntfy.sh",
      OPENCODE_NTFY_TOKEN: "my-secret-token",
      OPENCODE_NTFY_PRIORITY: "high",
    });
    expect(config.server).toBe("https://custom.ntfy.sh");
    expect(config.token).toBe("my-secret-token");
    expect(config.priority).toBe("high");
  });

  it("should throw when OPENCODE_NTFY_PRIORITY is not a valid value", () => {
    expect(() =>
      loadConfig({
        OPENCODE_NTFY_TOPIC: "test",
        OPENCODE_NTFY_PRIORITY: "invalid",
      })
    ).toThrow("OPENCODE_NTFY_PRIORITY");
  });

  it("should default iconUrl to dark mode GitHub raw URL using package version", () => {
    const config = loadConfig({ OPENCODE_NTFY_TOPIC: "test" });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should use light mode icon URL when OPENCODE_NTFY_ICON_MODE is light", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "light",
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-light.png`
    );
  });

  it("should use dark mode icon URL when OPENCODE_NTFY_ICON_MODE is dark", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "dark",
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should default to dark mode when OPENCODE_NTFY_ICON_MODE is an invalid value", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "neon",
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should use OPENCODE_NTFY_ICON_DARK override when mode is dark", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_DARK: "https://example.com/my-dark-icon.png",
    });
    expect(config.iconUrl).toBe("https://example.com/my-dark-icon.png");
  });

  it("should use OPENCODE_NTFY_ICON_LIGHT override when mode is light", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "light",
      OPENCODE_NTFY_ICON_LIGHT: "https://example.com/my-light-icon.png",
    });
    expect(config.iconUrl).toBe("https://example.com/my-light-icon.png");
  });

  it("should ignore OPENCODE_NTFY_ICON_LIGHT when mode is dark", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "dark",
      OPENCODE_NTFY_ICON_LIGHT: "https://example.com/my-light-icon.png",
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-dark.png`
    );
  });

  it("should ignore OPENCODE_NTFY_ICON_DARK when mode is light", () => {
    const config = loadConfig({
      OPENCODE_NTFY_TOPIC: "test",
      OPENCODE_NTFY_ICON_MODE: "light",
      OPENCODE_NTFY_ICON_DARK: "https://example.com/my-dark-icon.png",
    });
    expect(config.iconUrl).toBe(
      `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${VERSION}/assets/opencode-icon-light.png`
    );
  });
});
