import type { PluginInput } from "@opencode-ai/plugin";

type BunShell = PluginInput["$"];

export async function resolveField(
  $: BunShell,
  commandTemplate: string | undefined,
  variables: Record<string, string>,
  fallback: string
): Promise<string> {
  if (!commandTemplate) {
    return fallback;
  }

  return fallback;
}
