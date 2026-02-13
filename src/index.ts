import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig } from "./config.js";
import { sendNotification } from "./notify.js";

function getProjectName(directory: string): string {
  return directory.split("/").pop() || directory;
}

export const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  if (!process.env.OPENCODE_NTFY_TOPIC) {
    return {};
  }

  const config = loadConfig(process.env);
  const project = getProjectName(input.directory);

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await sendNotification(config, {
          title: `${project} - Session Idle`,
          message: `Event: session.idle\nProject: ${project}\nTime: ${new Date().toISOString()}`,
          tags: "hourglass_done",
        });
      } else if (event.type === "session.error") {
        const error = event.properties.error;
        const errorMsg =
          error && "data" in error && "message" in error.data
            ? `\nError: ${error.data.message}`
            : "";
        await sendNotification(config, {
          title: `${project} - Session Error`,
          message: `Event: session.error\nProject: ${project}\nTime: ${new Date().toISOString()}${errorMsg}`,
          tags: "warning",
        });
      } else if ((event.type as string) === "permission.asked") {
        const props = (event as any).properties as {
          permission?: string;
          patterns?: string[];
        };
        const permission = props.permission || "";
        const patterns = props.patterns?.join(", ") || "";
        const detail = permission
          ? `\nPermission: ${permission}${patterns ? ` (${patterns})` : ""}`
          : "";
        await sendNotification(config, {
          title: `${project} - Permission Requested`,
          message: `Event: permission.asked\nProject: ${project}\nTime: ${new Date().toISOString()}${detail}`,
          tags: "lock",
        });
      }
    },
    "permission.ask": async (permission) => {
      await sendNotification(config, {
        title: `${project} - Permission Requested`,
        message: `Event: permission.asked\nProject: ${project}\nTime: ${new Date().toISOString()}\nPermission: ${permission.title}`,
        tags: "lock",
      });
    },
  };
};

export default plugin;
