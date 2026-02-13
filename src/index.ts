import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig } from "./config.js";
import { sendNotification } from "./notify.js";

function getProjectName(directory: string): string {
  return directory.split("/").pop() || directory;
}

export const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  if (!process.env.NTFY_TOPIC) {
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
      }
    },
  };
};

export default plugin;
