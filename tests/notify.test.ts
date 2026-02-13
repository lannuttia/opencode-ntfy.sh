import { describe, it, expect, vi } from "vitest";
import { sendNotification } from "../src/notify.js";
import type { NtfyConfig } from "../src/config.js";

describe("sendNotification", () => {
  it("should send a POST request to the ntfy server with correct headers and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
    };

    await sendNotification(
      config,
      { title: "Test Title", message: "Test body", tags: "robot" },
      mockFetch
    );

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
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const config: NtfyConfig = {
      topic: "my-topic",
      server: "https://ntfy.sh",
      priority: "default",
      token: "my-secret-token",
    };

    await sendNotification(
      config,
      { title: "Test", message: "body", tags: "tag" },
      mockFetch
    );

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer my-secret-token");
  });
});
