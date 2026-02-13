import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig } from "./config.js";
import { sendNotification } from "./notify.js";
import { resolveField } from "./exec.js";

function getProjectName(directory: string): string {
  return directory.split("/").pop() || directory;
}

interface EventEnvVars {
  titleCmd: string | undefined;
  messageCmd: string | undefined;
  tagsCmd: string | undefined;
  priorityCmd: string | undefined;
}

function getEventEnvVars(prefix: string): EventEnvVars {
  return {
    titleCmd: process.env[`OPENCODE_NTFY_${prefix}_TITLE_CMD`],
    messageCmd: process.env[`OPENCODE_NTFY_${prefix}_MESSAGE_CMD`],
    tagsCmd: process.env[`OPENCODE_NTFY_${prefix}_TAGS_CMD`],
    priorityCmd: process.env[`OPENCODE_NTFY_${prefix}_PRIORITY_CMD`],
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
        const vars: Record<string, string> = {
          PROJECT: project,
          EVENT: "session.idle",
          TIME: time,
          ERROR: "",
          PERMISSION_TYPE: "",
          PERMISSION_PATTERNS: "",
        };
        const envVars = getEventEnvVars("SESSION_IDLE");

        const title = await resolveField($, envVars.titleCmd, vars, `${project} - Session Idle`);
        const message = await resolveField($, envVars.messageCmd, vars, `Event: session.idle\nProject: ${project}\nTime: ${time}`);
        const tags = await resolveField($, envVars.tagsCmd, vars, "hourglass_done");
        const priority = await resolveField($, envVars.priorityCmd, vars, config.priority);

        await sendNotification(config, {
          title,
          message,
          tags,
          priority: envVars.priorityCmd ? priority : undefined,
        });
      } else if (event.type === "session.error") {
        const error = event.properties.error;
        const errorMsg =
          error && "data" in error && "message" in error.data
            ? String(error.data.message)
            : "";
        const time = new Date().toISOString();
        const vars: Record<string, string> = {
          PROJECT: project,
          EVENT: "session.error",
          TIME: time,
          ERROR: errorMsg,
          PERMISSION_TYPE: "",
          PERMISSION_PATTERNS: "",
        };
        const envVars = getEventEnvVars("SESSION_ERROR");

        const defaultMessage = `Event: session.error\nProject: ${project}\nTime: ${time}${errorMsg ? `\nError: ${errorMsg}` : ""}`;
        const title = await resolveField($, envVars.titleCmd, vars, `${project} - Session Error`);
        const message = await resolveField($, envVars.messageCmd, vars, defaultMessage);
        const tags = await resolveField($, envVars.tagsCmd, vars, "warning");
        const priority = await resolveField($, envVars.priorityCmd, vars, config.priority);

        await sendNotification(config, {
          title,
          message,
          tags,
          priority: envVars.priorityCmd ? priority : undefined,
        });
      } else if ((event.type as string) === "permission.asked") {
        const props = (event as any).properties as {
          permission?: string;
          patterns?: string[];
        };
        const permissionType = props.permission || "";
        const patterns = props.patterns?.join(", ") || "";
        const time = new Date().toISOString();
        const vars: Record<string, string> = {
          PROJECT: project,
          EVENT: "permission.asked",
          TIME: time,
          ERROR: "",
          PERMISSION_TYPE: permissionType,
          PERMISSION_PATTERNS: patterns,
        };
        const envVars = getEventEnvVars("PERMISSION");

        const detail = permissionType
          ? `\nPermission: ${permissionType}${patterns ? ` (${patterns})` : ""}`
          : "";
        const title = await resolveField($, envVars.titleCmd, vars, `${project} - Permission Requested`);
        const message = await resolveField($, envVars.messageCmd, vars, `Event: permission.asked\nProject: ${project}\nTime: ${time}${detail}`);
        const tags = await resolveField($, envVars.tagsCmd, vars, "lock");
        const priority = await resolveField($, envVars.priorityCmd, vars, config.priority);

        await sendNotification(config, {
          title,
          message,
          tags,
          priority: envVars.priorityCmd ? priority : undefined,
        });
      }
    },
    "permission.ask": async (permission) => {
      const time = new Date().toISOString();
      const permissionType = permission.type || "";
      const patterns = Array.isArray(permission.pattern)
        ? permission.pattern.join(", ")
        : permission.pattern || "";
      const vars: Record<string, string> = {
        PROJECT: project,
        EVENT: "permission.asked",
        TIME: time,
        ERROR: "",
        PERMISSION_TYPE: permissionType,
        PERMISSION_PATTERNS: patterns,
      };
      const envVars = getEventEnvVars("PERMISSION");

      const title = await resolveField($, envVars.titleCmd, vars, `${project} - Permission Requested`);
      const message = await resolveField($, envVars.messageCmd, vars, `Event: permission.asked\nProject: ${project}\nTime: ${time}\nPermission: ${permission.title}`);
      const tags = await resolveField($, envVars.tagsCmd, vars, "lock");
      const priority = await resolveField($, envVars.priorityCmd, vars, config.priority);

      await sendNotification(config, {
        title,
        message,
        tags,
        priority: envVars.priorityCmd ? priority : undefined,
      });
    },
  };
};

export default plugin;
