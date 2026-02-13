export interface NtfyConfig {
  topic: string;
  server: string;
  token?: string;
  priority: string;
}

const VALID_PRIORITIES = ["min", "low", "default", "high", "max"];

export function loadConfig(
  env: Record<string, string | undefined>
): NtfyConfig {
  const topic = env.OPENCODE_NTFY_TOPIC;
  if (!topic) {
    throw new Error("OPENCODE_NTFY_TOPIC environment variable is required");
  }

  const priority = env.OPENCODE_NTFY_PRIORITY || "default";
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(
      `OPENCODE_NTFY_PRIORITY must be one of: ${VALID_PRIORITIES.join(", ")}`
    );
  }

  return {
    topic,
    server: env.OPENCODE_NTFY_SERVER || "https://ntfy.sh",
    token: env.OPENCODE_NTFY_TOKEN,
    priority,
  };
}
