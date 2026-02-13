import { describe, it, expect, vi } from "vitest";
import { plugin } from "../src/index.js";

describe("plugin", () => {
  it("should be an async function that returns hooks with an event handler", async () => {
    const hooks = await plugin({
      directory: "/home/user/my-project",
      env: { NTFY_TOPIC: "test-topic" },
    });

    expect(hooks).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(typeof hooks.event).toBe("function");
  });
});
