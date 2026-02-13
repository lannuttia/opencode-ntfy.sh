import type { PluginInput } from "@opencode-ai/plugin";

type BunShell = PluginInput["$"];

function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\$\{(\w+)\}/g, (_, name) => variables[name] ?? "");
}

export async function resolveField(
  $: BunShell,
  commandTemplate: string | undefined,
  variables: Record<string, string>,
  fallback: string
): Promise<string> {
  if (!commandTemplate) {
    return fallback;
  }

  try {
    const command = substituteVariables(commandTemplate, variables);
    const result = await $`${{ raw: command }}`.nothrow().quiet();

    if (result.exitCode !== 0) {
      return fallback;
    }

    const text = result.text().trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}
