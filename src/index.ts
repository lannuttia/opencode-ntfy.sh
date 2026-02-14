import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig, type NtfyConfig } from "./config.js";
import { sendNotification } from "./notify.js";
import { resolveField } from "./exec.js";
import { createCooldownGuard, type CooldownGuard } from "./cooldown.js";

type BunShell = PluginInput["$"];

interface NotificationDefaults {
  title: string;
  message: string;
  tags: string;
}

async function resolveAndSend(
  $: BunShell,
  config: NtfyConfig,
  envPrefix: string,
  vars: Record<string, string>,
  defaults: NotificationDefaults
): Promise<void> {
  const titleCmd = process.env[`OPENCODE_NTFY_${envPrefix}_TITLE_CMD`];
  const messageCmd = process.env[`OPENCODE_NTFY_${envPrefix}_MESSAGE_CMD`];
  const tagsCmd = process.env[`OPENCODE_NTFY_${envPrefix}_TAGS_CMD`];
  const priorityCmd = process.env[`OPENCODE_NTFY_${envPrefix}_PRIORITY_CMD`];

  const title = await resolveField($, titleCmd, vars, defaults.title);
  const message = await resolveField($, messageCmd, vars, defaults.message);
  const tags = await resolveField($, tagsCmd, vars, defaults.tags);
  const priority = await resolveField($, priorityCmd, vars, config.priority);

  await sendNotification(config, {
    title,
    message,
    tags,
    priority: priorityCmd ? priority : undefined,
  });
}

function buildVars(
  event: string,
  time: string,
  extra: Partial<Record<"error" | "permission_type" | "permission_patterns", string>> = {}
): Record<string, string> {
  return {
    event,
    time,
    error: extra.error ?? "",
    permission_type: extra.permission_type ?? "",
    permission_patterns: extra.permission_patterns ?? "",
  };
}

function hasPermissionProperties(
  event: { properties?: unknown }
): event is { properties: { permission?: string; patterns?: string[] } } {
  return typeof event.properties === "object" && event.properties !== null;
}

export const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  if (!process.env.OPENCODE_NTFY_TOPIC) {
    return {};
  }

  const config = loadConfig(process.env);
  const $ = input.$;

  let cooldownGuard: CooldownGuard | undefined;
  if (config.cooldown) {
    cooldownGuard = createCooldownGuard({
      cooldown: config.cooldown,
      edge: config.cooldownEdge,
    });
  }

  return {
    event: async ({ event }) => {
      const eventType: string = event.type;

      if (cooldownGuard && !cooldownGuard.shouldAllow(eventType)) {
        return;
      }

      if (event.type === "session.idle") {
        const time = new Date().toISOString();
        const vars = buildVars("session.idle", time);

        await resolveAndSend($, config, "SESSION_IDLE", vars, {
          title: "Agent Idle",
          message: "The agent has finished and is waiting for input.",
          tags: "hourglass_done",
        });
      } else if (event.type === "session.error") {
        const error = event.properties.error;
        const errorMsg =
          error && "data" in error && "message" in error.data
            ? String(error.data.message)
            : "";
        const time = new Date().toISOString();
        const vars = buildVars("session.error", time, { error: errorMsg });

        await resolveAndSend($, config, "SESSION_ERROR", vars, {
          title: "Agent Error",
          message: "An error has occurred. Check the session for details.",
          tags: "warning",
        });
      } else if (eventType === "permission.asked" && hasPermissionProperties(event)) {
        const permissionType = event.properties.permission || "";
        const patternsArr = event.properties.patterns;
        const patterns = Array.isArray(patternsArr) ? patternsArr.join(", ") : "";
        const time = new Date().toISOString();
        const vars = buildVars("permission.asked", time, {
          permission_type: permissionType,
          permission_patterns: patterns,
        });

        await resolveAndSend($, config, "PERMISSION", vars, {
          title: "Permission Asked",
          message: "The agent needs permission to continue. Review and respond.",
          tags: "lock",
        });
      }
    },
  };
};

export default plugin;
