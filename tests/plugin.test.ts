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

  it("should send a notification when a session.idle event is received", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const hooks = await plugin({
      directory: "/home/user/my-project",
      env: {
        NTFY_TOPIC: "test-topic",
        NTFY_SERVER: "https://ntfy.example.com",
      },
      fetchFn: mockFetch,
    });

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://ntfy.example.com/test-topic");
    expect(options.method).toBe("POST");
    expect(options.headers.Title).toContain("my-project");
    expect(options.headers.Title).toContain("Idle");
    expect(options.body).toContain("session.idle");
    expect(options.body).toContain("my-project");
  });

  it("should send a notification with error message when a session.error event is received", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const hooks = await plugin({
      directory: "/home/user/my-project",
      env: {
        NTFY_TOPIC: "test-topic",
        NTFY_SERVER: "https://ntfy.example.com",
      },
      fetchFn: mockFetch,
    });

    await hooks.event!({
      event: {
        type: "session.error",
        properties: {
          sessionID: "abc-123",
          error: {
            name: "UnknownError",
            data: { message: "Something went wrong" },
          },
        },
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://ntfy.example.com/test-topic");
    expect(options.method).toBe("POST");
    expect(options.headers.Title).toContain("my-project");
    expect(options.headers.Title).toContain("Error");
    expect(options.body).toContain("session.error");
    expect(options.body).toContain("Something went wrong");
  });

  it("should return empty hooks when NTFY_TOPIC is not set", async () => {
    const mockFetch = vi.fn();

    const hooks = await plugin({
      directory: "/home/user/my-project",
      env: {},
      fetchFn: mockFetch,
    });

    expect(hooks.event).toBeUndefined();
  });
});
