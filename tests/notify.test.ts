import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { sendNotification } from "../src/notify.js";
import type { NtfyConfig } from "../src/config.js";

// Capture request details for assertions
let capturedRequest: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
} | null = null;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  capturedRequest = null;
  server.resetHandlers();
});
afterAll(() => server.close());

describe("sendNotification", () => {
  it("should send a POST request to the ntfy server with correct headers and body", async () => {
    server.use(
      http.post("https://ntfy.sh/my-topic", async ({ request }) => {
        capturedRequest = {
          url: request.url,
          method: request.method,
          headers: {
            Title: request.headers.get("Title") ?? "",
            Priority: request.headers.get("Priority") ?? "",
            Tags: request.headers.get("Tags") ?? "",
          },
          body: await request.text(),
        };
        return HttpResponse.text("ok");
      })
    );

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
    expect(capturedRequest!.headers.Title).toBe("Test Title");
    expect(capturedRequest!.headers.Priority).toBe("default");
    expect(capturedRequest!.headers.Tags).toBe("robot");
    expect(capturedRequest!.body).toBe("Test body");
  });

  it("should not include Authorization header when token is not set", async () => {
    server.use(
      http.post("https://ntfy.sh/my-topic", async ({ request }) => {
        capturedRequest = {
          url: request.url,
          method: request.method,
          headers: {
            Authorization: request.headers.get("Authorization") ?? "",
          },
          body: await request.text(),
        };
        return HttpResponse.text("ok");
      })
    );

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
    expect(capturedRequest!.headers.Authorization).toBe("");
  });

  it("should include Authorization header when token is set", async () => {
    server.use(
      http.post("https://ntfy.sh/my-topic", async ({ request }) => {
        capturedRequest = {
          url: request.url,
          method: request.method,
          headers: {
            Authorization: request.headers.get("Authorization") ?? "",
          },
          body: await request.text(),
        };
        return HttpResponse.text("ok");
      })
    );

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
    expect(capturedRequest!.headers.Authorization).toBe(
      "Bearer my-secret-token"
    );
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
