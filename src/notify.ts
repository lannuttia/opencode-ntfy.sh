import type { NtfyConfig } from "./config.js";

export interface NotificationPayload {
  title: string;
  message: string;
  tags: string;
}

type FetchFn = typeof globalThis.fetch;

export async function sendNotification(
  config: NtfyConfig,
  payload: NotificationPayload,
  fetchFn: FetchFn = globalThis.fetch
): Promise<void> {
  const url = `${config.server}/${config.topic}`;

  const headers: Record<string, string> = {
    Title: payload.title,
    Priority: config.priority,
    Tags: payload.tags,
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const response = await fetchFn(url, {
    method: "POST",
    headers,
    body: payload.message,
  });

  if (!response.ok) {
    throw new Error(
      `ntfy request failed: ${response.status} ${response.statusText}`
    );
  }
}
