import type { NtfyConfig } from "./config.js";

export interface NotificationPayload {
  title: string;
  message: string;
  tags: string;
  priority?: string;
}

export async function sendNotification(
  config: NtfyConfig,
  payload: NotificationPayload
): Promise<void> {
  const url = `${config.server}/${config.topic}`;

  const headers: Record<string, string> = {
    Title: payload.title,
    Priority: payload.priority ?? config.priority,
    Tags: payload.tags,
    "X-Icon": config.iconUrl,
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const fetchOptions: RequestInit = {
    method: "POST",
    headers,
    body: payload.message,
  };

  if (config.fetchTimeout !== undefined) {
    fetchOptions.signal = AbortSignal.timeout(config.fetchTimeout);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    throw new Error(
      `ntfy request failed: ${response.status} ${response.statusText}`
    );
  }
}
