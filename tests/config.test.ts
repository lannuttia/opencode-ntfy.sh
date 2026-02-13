import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("should return a config object with the topic when NTFY_TOPIC is set", () => {
    const env = { NTFY_TOPIC: "my-topic" };
    const config = loadConfig(env);
    expect(config.topic).toBe("my-topic");
  });

  it("should throw an error when NTFY_TOPIC is not set", () => {
    expect(() => loadConfig({})).toThrow("NTFY_TOPIC");
  });

  it("should use default server and priority when not specified", () => {
    const config = loadConfig({ NTFY_TOPIC: "test" });
    expect(config.server).toBe("https://ntfy.sh");
    expect(config.priority).toBe("default");
    expect(config.token).toBeUndefined();
  });

  it("should use custom server, token, and priority from env", () => {
    const config = loadConfig({
      NTFY_TOPIC: "test",
      NTFY_SERVER: "https://custom.ntfy.sh",
      NTFY_TOKEN: "my-secret-token",
      NTFY_PRIORITY: "high",
    });
    expect(config.server).toBe("https://custom.ntfy.sh");
    expect(config.token).toBe("my-secret-token");
    expect(config.priority).toBe("high");
  });

  it("should throw when NTFY_PRIORITY is not a valid value", () => {
    expect(() =>
      loadConfig({ NTFY_TOPIC: "test", NTFY_PRIORITY: "invalid" })
    ).toThrow("NTFY_PRIORITY");
  });
});
