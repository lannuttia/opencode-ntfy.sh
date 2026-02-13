import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import defaultExport, { plugin } from "../src/index.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

let capturedRequest: CapturedRequest | null = null;

function captureHandler(url: string) {
  return http.post(url, async ({ request }) => {
    capturedRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    };
    return HttpResponse.text("ok");
  });
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  capturedRequest = null;
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

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
  it("should satisfy the Plugin type from @opencode-ai/plugin", () => {
    const p: Plugin = plugin;
    expect(p).toBe(plugin);
  });

  it("should be an async function that returns hooks with an event handler", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    server.use(captureHandler("https://ntfy.sh/test-topic"));

    const hooks = await plugin(createMockInput());

    expect(hooks).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(typeof hooks.event).toBe("function");
  });

  it("should send a notification when a session.idle event is received", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    vi.stubEnv("NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Idle");
    expect(capturedRequest!.body).toContain("session.idle");
    expect(capturedRequest!.body).toContain("my-project");
  });

  it("should send a notification with error message when a session.error event is received", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    vi.stubEnv("NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Error");
    expect(capturedRequest!.body).toContain("session.error");
    expect(capturedRequest!.body).toContain("Something went wrong");
  });

  it("should return empty hooks when NTFY_TOPIC is not set", async () => {
    const hooks = await plugin(createMockInput());
    expect(hooks.event).toBeUndefined();
  });

  it("should not send a notification for non-session events", async () => {
    vi.stubEnv("NTFY_TOPIC", "test-topic");
    server.use(captureHandler("https://ntfy.sh/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "message.updated" as any,
        properties: { info: {} } as any,
      },
    });

    expect(capturedRequest).toBeNull();
  });

  it("should have a default export that is the same as the named plugin export", () => {
    expect(defaultExport).toBe(plugin);
  });
});
