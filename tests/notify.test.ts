import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { sendNotification } from "../src/notify.js";
import type { NtfyConfig } from "../src/config.js";
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
});
afterAll(() => server.close());

describe("sendNotification", () => {
  it("should send a POST request to the ntfy server with correct headers and body", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
    };

    await sendNotification(config, {
      title: "Test Title",
      message: "Test body",
      tags: "robot",
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://ntfy.sh/my-topic");
    expect(capturedRequest!.method).toBe("POST");
    expect(capturedRequest!.headers.get("Title")).toBe("Test Title");
    expect(capturedRequest!.headers.get("Priority")).toBe("default");
    expect(capturedRequest!.headers.get("Tags")).toBe("robot");
    expect(capturedRequest!.body).toBe("Test body");
  });

  it("should not include Authorization header when token is not set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
    };

    await sendNotification(config, {
      title: "Test Title",
      message: "Test body",
      tags: "robot",
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Authorization")).toBeNull();
  });

  it("should include Authorization header when token is set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      token: "my-secret-token",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Authorization")).toBe(
      "Bearer my-secret-token"
    );
  });

  it("should use payload.priority when set, overriding config.priority", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
      priority: "high",
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Priority")).toBe("high");
  });

  it("should use config.priority when payload.priority is not set", async () => {
    server.use(captureHandler("https://ntfy.sh/my-topic"));

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "low",
    };

    await sendNotification(config, {
      title: "Test",
      message: "body",
      tags: "tag",
    });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.headers.get("Priority")).toBe("low");
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
