export interface NtfyConfig {
  topic: string;
  server: string;
  token?: string;
  priority: string;
}

export function loadConfig(
  env: Record<string, string | undefined>
): NtfyConfig {
  return {
    topic: env.NTFY_TOPIC!,
    server: "https://ntfy.sh",
    priority: "default",
  };
}
