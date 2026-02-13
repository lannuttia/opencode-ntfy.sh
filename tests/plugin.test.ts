import { describe, it, expect, vi, beforeEach } from "vitest";
import { plugin } from "../src/index.js";

describe("plugin", () => {
  it("should send a notification on session.idle event", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const p = plugin(
      {
        NTFY_TOPIC: "test-topic",
        NTFY_SERVER: "https://ntfy.example.com",
      },
      mockFetch
    );

    const idleHook = p.hooks["session.idle"];
    expect(idleHook).toBeDefined();

    await idleHook!({ cwd: "/home/user/my-project" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://ntfy.example.com/test-topic");
    expect(options.method).toBe("POST");
    expect(options.headers.Title).toContain("my-project");
    expect(options.body).toContain("session.idle");
  });

  it("should send a notification on session.error event with error message", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const p = plugin(
      {
        NTFY_TOPIC: "test-topic",
        NTFY_SERVER: "https://ntfy.example.com",
      },
      mockFetch
    );

    const errorHook = p.hooks["session.error"];
    expect(errorHook).toBeDefined();

    await errorHook!({
      cwd: "/home/user/my-project",
      error: "Something went wrong",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://ntfy.example.com/test-topic");
    expect(options.headers.Title).toContain("my-project");
    expect(options.body).toContain("session.error");
    expect(options.body).toContain("Something went wrong");
  });
});
