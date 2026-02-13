export interface NtfyConfig {
  topic: string;
  server: string;
  token?: string;
  priority: string;
}

export function loadConfig(
  env: Record<string, string | undefined>
): NtfyConfig {
  const topic = env.NTFY_TOPIC;
  if (!topic) {
    throw new Error("NTFY_TOPIC environment variable is required");
  }

  return {
    topic,
    server: env.NTFY_SERVER || "https://ntfy.sh",
    token: env.NTFY_TOKEN,
    priority: env.NTFY_PRIORITY || "default",
  };
}
