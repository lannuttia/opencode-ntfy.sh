import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import defaultExport, { plugin } from "../src/index.js";

function createMockInput(
  overrides: Partial<PluginInput> = {}
): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {
      id: "proj-1",
      worktree: "/home/user/my-project",
      time: { created: Date.now() },
    },
    directory: "/home/user/my-project",
    worktree: "/home/user/my-project",
    serverUrl: new URL("http://localhost:3000"),
    $: (() => {}) as unknown as PluginInput["$"],
    ...overrides,
  };
}

describe("plugin", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should satisfy the Plugin type from @opencode-ai/plugin", () => {
    const p: Plugin = plugin;
    expect(p).toBe(plugin);
  });

  it("should be an async function that returns hooks with an event handler", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");

    const hooks = await plugin(createMockInput());

    expect(hooks).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(typeof hooks.event).toBe("function");
  });

  it("should send a notification when a session.idle event is received", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    vi.stubEnv("NTFY_SERVER", "https://ntfy.example.com");

    const hooks = await plugin(createMockInput());

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
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    vi.stubEnv("NTFY_SERVER", "https://ntfy.example.com");

    const hooks = await plugin(createMockInput());

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
    const hooks = await plugin(createMockInput());

    expect(hooks.event).toBeUndefined();
  });

  it("should not send a notification for non-session events", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "message.updated" as any,
        properties: { info: {} } as any,
      },
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should have a default export that is the same as the named plugin export", () => {
    expect(defaultExport).toBe(plugin);
  });
});
