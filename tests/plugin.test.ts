import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import defaultExport, { plugin } from "../src/index.js";
import {
  server,
  captureHandler,
  capturedRequest,
  resetCapturedRequest,
} from "./msw-helpers.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  resetCapturedRequest();
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

type BunShell = PluginInput["$"];

function createMockShell(
  handler?: (command: string) => { stdout: string; exitCode: number }
): BunShell {
  const defaultHandler = () => ({ stdout: "", exitCode: 0 });
  const actualHandler = handler ?? defaultHandler;

  const shell = ((strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0];
    for (let i = 0; i < expressions.length; i++) {
      const expr = expressions[i];
      if (expr && typeof expr === "object" && "raw" in expr && typeof (expr as any).raw === "string") {
        command += (expr as { raw: string }).raw;
      } else {
        command += String(expr);
      }
      command += strings[i + 1];
    }

    const result = actualHandler(command);
    const buf = Buffer.from(result.stdout);
    const output = {
      stdout: buf,
      stderr: Buffer.from(""),
      exitCode: result.exitCode,
      text: () => result.stdout,
      json: () => JSON.parse(result.stdout),
      arrayBuffer: () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      bytes: () => new Uint8Array(buf),
      blob: () => new Blob([buf]),
    };

    const shellPromise: any = {
      then: (resolve?: (value: any) => unknown, reject?: (reason: unknown) => unknown) => {
        return Promise.resolve(output).then(resolve, reject);
      },
      catch: (reject?: (reason: unknown) => unknown) => {
        return Promise.resolve(output).catch(reject);
      },
      quiet: function () { return this; },
      nothrow: function () { return this; },
      text: () => Promise.resolve(result.stdout),
    };

    return shellPromise;
  }) as unknown as BunShell;

  return shell;
}

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
    $: createMockShell(),
    ...overrides,
  };
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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Idle");
    expect(capturedRequest!.body).toContain("session.idle");
    expect(capturedRequest!.body).toContain("my-project");
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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Error");
    expect(capturedRequest!.body).toContain("session.error");
    expect(capturedRequest!.body).toContain("Something went wrong");
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

    await hooks.event!({
      event: {
        type: "message.updated" as any,
        properties: { info: {} } as any,
      },
    });

    expect(capturedRequest).toBeNull();
  });

  it("should send a notification when a permission.ask hook is called", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    expect(hooks["permission.ask"]).toBeDefined();
    expect(typeof hooks["permission.ask"]).toBe("function");

    const permissionInput = {
      id: "perm-1",
      type: "file.write",
      sessionID: "abc-123",
      messageID: "msg-1",
      title: "Write to config.json",
      metadata: {},
      time: { created: Date.now() },
    };

    await hooks["permission.ask"]!(permissionInput, { status: "ask" });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Permission");
    expect(capturedRequest!.body).toContain("permission.asked");
    expect(capturedRequest!.body).toContain("my-project");
    expect(capturedRequest!.body).toContain("Write to config.json");
  });

  it("should not return permission.ask hook when OPENCODE_NTFY_TOPIC is not set", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "");
    const hooks = await plugin(createMockInput());
    expect(hooks["permission.ask"]).toBeUndefined();
  });

  it("should send a notification when a permission.asked event is received via the event hook", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const hooks = await plugin(createMockInput());

    await hooks.event!({
      event: {
        type: "permission.asked",
        properties: {
          id: "perm-1",
          permission: "file.write",
          sessionID: "abc-123",
          patterns: ["config.json"],
          metadata: {},
          always: ["config.json"],
        },
      } as any,
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.example.com/test-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toContain("my-project");
    expect(capturedRequest!.headers.get("Title")).toContain("Permission");
    expect(capturedRequest!.body).toContain("permission.asked");
    expect(capturedRequest!.body).toContain("my-project");
    expect(capturedRequest!.body).toContain("file.write");
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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Title")).toBe("Custom Idle Title");
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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Priority")).toBe("max");
  });

  it("should substitute template variables in custom commands", async () => {
    vi.stubEnv("OPENCODE_NTFY_TOPIC", "test-topic");
    vi.stubEnv("OPENCODE_NTFY_SERVER", "https://ntfy.example.com");
    vi.stubEnv("OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD", 'echo "${PROJECT} is idle"');
    server.use(captureHandler("https://ntfy.example.com/test-topic"));

    const mock$ = createMockShell((cmd) => {
      if (cmd === 'echo "my-project is idle"') {
        return { stdout: "my-project is idle", exitCode: 0 };
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

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Title")).toBe("my-project is idle");
  });

  it("should use custom commands for permission.ask hook", async () => {
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

    const permissionInput = {
      id: "perm-1",
      type: "file.write",
      sessionID: "abc-123",
      messageID: "msg-1",
      title: "Write to config.json",
      metadata: {},
      time: { created: Date.now() },
    };

    await hooks["permission.ask"]!(permissionInput, { status: "ask" });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Title")).toBe("Custom Permission");
  });
});
