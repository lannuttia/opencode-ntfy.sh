import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

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
});
