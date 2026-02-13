import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendNotification } from "../src/notify.js";
import type { NtfyConfig } from "../src/config.js";

describe("sendNotification", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should send a POST request to the ntfy server with correct headers and body", async () => {
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

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/my-topic");
    expect(options.method).toBe("POST");
    expect(options.headers.Title).toBe("Test Title");
    expect(options.headers.Priority).toBe("default");
    expect(options.headers.Tags).toBe("robot");
    expect(options.body).toBe("Test body");
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("should include Authorization header when token is set", async () => {
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

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer my-secret-token");
  });

  it("should throw when the server responds with a non-ok status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

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
