import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { sendNotification } from "../src/notify.js";
import type { NtfyConfig } from "../src/config.js";
import {
  server,
  captureHandler,
  getCapturedRequest,
  resetCapturedRequest,
} from "./msw-helpers.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  resetCapturedRequest();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe("sendNotification", () => {
  it("should send a POST request to the ntfy server with correct headers and body", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test Title",
      message: "Test body",
      tags: "robot",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe("https://ntfy.sh/my-topic");
    expect(captured!.method).toBe("POST");
    expect(captured!.headers.get("Title")).toBe("Test Title");
    expect(captured!.headers.get("Priority")).toBe("default");
    expect(captured!.headers.get("Tags")).toBe("robot");
    expect(captured!.body).toBe("Test body");
  });

  it("should not include Authorization header when token is not set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test Title",
      message: "Test body",
      tags: "robot",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("Authorization")).toBeNull();
  });

  it("should include Authorization header when token is set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      token: "my-secret-token",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("Authorization")).toBe(
      "Bearer my-secret-token"
    );
  });

  it("should use payload.priority when set, overriding config.priority", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
      priority: "high",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("Priority")).toBe("high");
  });

  it("should use config.priority when payload.priority is not set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "low",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("Priority")).toBe("low");
  });

  it("should include X-Icon header from config.iconUrl", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    const captured = getCapturedRequest();
    expect(captured).not.toBeNull();
    expect(captured!.headers.get("X-Icon")).toBe(
      "https://example.com/icon.png"
    );
  });

  it("should include AbortSignal.timeout when config.fetchTimeout is set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
      fetchTimeout: 10000,
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1];
    expect(requestInit).toBeDefined();
    expect(requestInit!.signal).toBeInstanceOf(AbortSignal);
  });

  it("should not include signal when config.fetchTimeout is not set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1];
    expect(requestInit).toBeDefined();
    expect(requestInit!.signal).toBeUndefined();
  });

  it("should throw when the server responds with a non-ok status", async () => {
    server.use(
      http.post("https://ntfy.sh/my-topic", () => {
        return new HttpResponse(null, {
          status: 500,
          statusText: "Server Error",
        });
      })
    );

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      iconUrl: "https://example.com/icon.png",
    };

    await expect(
      sendNotification(config, {
        title: "Test",
        message: "body",
        tags: "tag",
      })
    ).rejects.toThrow("500");
  });
});
