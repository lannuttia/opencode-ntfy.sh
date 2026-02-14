import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig, type NtfyConfig } from "./config.js";
import { sendNotification } from "./notify.js";
import { resolveField } from "./exec.js";

type BunShell = PluginInput["$"];

function getProjectName(directory: string): string {
  return directory.split("/").pop() || directory;
}

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

export const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  if (!process.env.OPENCODE_NTFY_TOPIC) {
    return {};
  }

  const config = loadConfig(process.env);
  const project = getProjectName(input.directory);
  const $ = input.$;

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        const time = new Date().toISOString();
        const vars = buildVars("session.idle", time);

        await resolveAndSend($, config, "SESSION_IDLE", vars, {
          title: "Agent Idle",
          message: `Event: session.idle\nProject: ${project}\nTime: ${time}`,
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
          message: `Event: session.error\nProject: ${project}\nTime: ${time}${errorMsg ? `\nError: ${errorMsg}` : ""}`,
          tags: "warning",
        });
      } else if ((event.type as string) === "permission.asked") {
        const props = (event as any).properties as {
          permission?: string;
          patterns?: string[];
        };
        const permissionType = props.permission || "";
        const patterns = props.patterns?.join(", ") || "";
        const time = new Date().toISOString();
        const vars = buildVars("permission.asked", time, {
          permission_type: permissionType,
          permission_patterns: patterns,
        });
        const detail = permissionType
          ? `\nPermission: ${permissionType}${patterns ? ` (${patterns})` : ""}`
          : "";

        await resolveAndSend($, config, "PERMISSION", vars, {
          title: "Permission Asked",
          message: `Event: permission.asked\nProject: ${project}\nTime: ${time}${detail}`,
          tags: "lock",
        });
      }
    },
    "permission.ask": async (permission) => {
      const time = new Date().toISOString();
      const permissionType = permission.type || "";
      const patterns = Array.isArray(permission.pattern)
        ? permission.pattern.join(", ")
        : permission.pattern || "";
      const vars = buildVars("permission.asked", time, {
        permission_type: permissionType,
        permission_patterns: patterns,
      });

      await resolveAndSend($, config, "PERMISSION", vars, {
        title: "Permission Asked",
        message: `Event: permission.asked\nProject: ${project}\nTime: ${time}\nPermission: ${permission.title}`,
        tags: "lock",
      });
    },
  };
};

export default plugin;
