import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("should return a config object with the topic when NTFY_TOPIC is set", () => {
    const env = { NTFY_TOPIC: "my-topic" };
    const config = loadConfig(env);
    expect(config.topic).toBe("my-topic");
  });
});
