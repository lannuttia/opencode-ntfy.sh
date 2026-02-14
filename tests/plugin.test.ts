import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import defaultExport, { plugin } from "../src/index.js";
import {
  server,
  captureHandler,
  getCapturedRequest,
  resetCapturedRequest,
} from "./msw-helpers.js";
import { createMockShell } from "./mock-shell.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  resetCapturedRequest();
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

function createMockInput(
  overrides: Partial<PluginInput> = {}
): PluginInput {
  return {
    // @ts-expect-error - mock client for testing; real client is not needed
    client: {},
    project: {
      id: "proj-1",
      worktree: "/home/user/my-project",
      time: { created: Date.now() },
    },
    directory: "/home/user/my-project",
    worktree: "/home/user/my-project",
    serverUrl: new URL("http://localhost:3000"),
    $: createMockShell(),
    ...overrides,
  };
}

/**
 * Helper to invoke the event hook with an event object.
 * Uses @ts-expect-error for events not in the current SDK's Event union
 * (e.g., permission.asked) that nonetheless exist at runtime.
 */
async function fireEvent(
  hooks: Awaited<ReturnType<Plugin>>,
  event: { type: string; properties: Record<string, unknown> }
): Promise<void> {
  // @ts-expect-error - allows passing event types not yet in the SDK's Event union
  await hooks.event!({ event });
}

describe("plugin", () => {
  it("should satisfy the Plugin type from @opencode-ai/plugin", () => {
    const p: Plugin = plugin;
    expect(p).toBe(plugin);
  });

  it("should be an async function that returns hooks with an event handler", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    server.use(captureHandler("https://ntfy.sh/test-topic"));

    const hooks = await plugin(createMockInput());

    expect(hooks).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(typeof hooks.event).toBe("function");
  });

  it("should send a notification when a session.idle event is received", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.url).toBe("https://ntfy.example.com/test-topic");
    expect(getCapturedRequest()!.method).toBe("POST");
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Agent Idle");
  });

  it("should send a notification with error message when a session.error event is received", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
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

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.url).toBe("https://ntfy.example.com/test-topic");
    expect(getCapturedRequest()!.method).toBe("POST");
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Agent Error");
  });

  it("should return empty hooks when OPENCODE_NTFY_TOPIC is not set", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "");
    const hooks = await plugin(createMockInput());
    expect(hooks.event).toBeUndefined();
  });

  it("should not send a notification for non-session events", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    server.use(captureHandler("https://ntfy.sh/test-topic"));

    const hooks = await plugin(createMockInput());

    await fireEvent(hooks, {
      type: "message.updated",
      properties: { info: {} },
    });

    expect(getCapturedRequest()).toBeNull();
  });

  it("should send a notification when a permission.asked event is received via the event hook", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await fireEvent(hooks, {
      type: "permission.asked",
      properties: {
        id: "perm-1",
        permission: "file.write",
        sessionID: "abc-123",
        patterns: ["config.json"],
        metadata: {},
        always: ["config.json"],
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.url).toBe("https://ntfy.example.com/test-topic");
    expect(getCapturedRequest()!.method).toBe("POST");
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Permission Asked");
  });

  it("should have a default export that is the same as the named plugin export", () => {
    expect(defaultExport).toBe(plugin);
  });

  it("should use custom title command for session.idle when OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD is set", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD", 'echo "Custom Idle Title"');
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const mock$ = createMockShell((cmd) => {
      if (cmd === 'echo "Custom Idle Title"') {
        return { stdout: "Custom Idle Title", exitCode: 0 };
      }
      return { stdout: "", exitCode: 1 };
    });

    const hooks = await plugin(createMockInput({ $: mock$ }));

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Custom Idle Title");
  });

  it("should use custom priority command for session.error", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_SESSION_ERROR_PRIORITY_CMD", "echo max");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const mock$ = createMockShell((cmd) => {
      if (cmd === "echo max") {
        return { stdout: "max", exitCode: 0 };
      }
      return { stdout: "", exitCode: 1 };
    });

    const hooks = await plugin(createMockInput({ $: mock$ }));

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

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Priority")).toBe("max");
  });

  it("should substitute template variables in custom commands using underscored names", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD", 'echo "${event} is done"');
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const mock$ = createMockShell((cmd) => {
      if (cmd === 'echo "session.idle is done"') {
        return { stdout: "session.idle is done", exitCode: 0 };
      }
      return { stdout: "", exitCode: 1 };
    });

    const hooks = await plugin(createMockInput({ $: mock$ }));

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("session.idle is done");
  });

  it("should include X-Icon header with default dark icon URL in session.idle notification", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    const iconHeader = getCapturedRequest()!.headers.get("X-Icon");
    expect(iconHeader).not.toBeNull();
    expect(iconHeader).toContain("opencode-icon-dark.png");
    expect(iconHeader).toContain("raw.githubusercontent.com");
  });

  it("should include X-Icon header with light icon URL when OPENCODE_NTFY_ICON_MODE is light", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_ICON_MODE", "light");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    const iconHeader = getCapturedRequest()!.headers.get("X-Icon");
    expect(iconHeader).not.toBeNull();
    expect(iconHeader).toContain("opencode-icon-light.png");
    expect(iconHeader).toContain("raw.githubusercontent.com");
  });

  it("should use default title 'Agent Idle' for session.idle events", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Agent Idle");
  });

  it("should use default title 'Agent Error' for session.error events", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
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

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Agent Error");
  });

  it("should use default title 'Permission Asked' for permission.asked events", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await fireEvent(hooks, {
      type: "permission.asked",
      properties: {
        id: "perm-1",
        permission: "file.write",
        sessionID: "abc-123",
        patterns: ["config.json"],
        metadata: {},
        always: ["config.json"],
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Permission Asked");
  });

  it("should use default message for session.idle per spec", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.body).toBe(
      "The agent has finished and is waiting for input."
    );
  });

  it("should use default message for session.error per spec", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
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

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.body).toBe(
      "An error has occurred. Check the session for details."
    );
  });

  it("should use default message for permission.asked per spec", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await fireEvent(hooks, {
      type: "permission.asked",
      properties: {
        id: "perm-1",
        permission: "file.write",
        sessionID: "abc-123",
        patterns: ["config.json"],
        metadata: {},
        always: ["config.json"],
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.body).toBe(
      "The agent needs permission to continue. Review and respond."
    );
  });

  it("should use custom icon URL from OPENCODE_NTFY_ICON_DARK when mode is dark", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_ICON_DARK", "https://example.com/custom-dark.png");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("X-Icon")).toBe(
      "https://example.com/custom-dark.png"
    );
  });

  it("should not include a permission.ask hook (spec only uses event hook)", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    const hooks = await plugin(createMockInput());
    expect(hooks["permission.ask"]).toBeUndefined();
  });

  it("should use custom commands for permission.asked event via event hook", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_PERMISSION_TITLE_CMD", 'echo "Custom Permission"');
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const mock$ = createMockShell((cmd) => {
      if (cmd === 'echo "Custom Permission"') {
        return { stdout: "Custom Permission", exitCode: 0 };
      }
      return { stdout: "", exitCode: 1 };
    });

    const hooks = await plugin(createMockInput({ $: mock$ }));

    await fireEvent(hooks, {
      type: "permission.asked",
      properties: {
        id: "perm-1",
        permission: "file.write",
        sessionID: "abc-123",
        patterns: ["config.json"],
        metadata: {},
        always: ["config.json"],
      },
    });

    expect(getCapturedRequest()).not.toBeNull();
    expect(getCapturedRequest()!.headers.get("Title")).toBe("Custom Permission");
  });

  it("should suppress duplicate notifications within the cooldown period", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_COOLDOWN", "PT5S");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).not.toBeNull();

    resetCapturedRequest();

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).toBeNull();

    vi.useRealTimers();
  });

  it("should allow notifications after cooldown period expires", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_COOLDOWN", "PT5S");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).not.toBeNull();

    resetCapturedRequest();
    vi.advanceTimersByTime(5001);

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).not.toBeNull();

    vi.useRealTimers();
  });

  it("should not apply cooldown when OPENCODE_NTFY_COOLDOWN is not set", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).not.toBeNull();

    resetCapturedRequest();

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc-123" },
      },
    });
    expect(getCapturedRequest()).not.toBeNull();
  });
});
