import { loadConfig } from "./config.js";
import { sendNotification } from "./notify.js";

type FetchFn = typeof globalThis.fetch;

interface EventData {
  cwd: string;
  error?: string;
}

interface PluginHooks {
  "session.idle"?: (data: EventData) => Promise<void>;
  "session.error"?: (data: EventData) => Promise<void>;
}

interface Plugin {
  hooks: PluginHooks;
}

function getProjectName(cwd: string): string {
  return cwd.split("/").pop() || cwd;
}

export function plugin(
  env: Record<string, string | undefined> = process.env,
  fetchFn?: FetchFn
): Plugin {
  if (!env.NTFY_TOPIC) {
    return { hooks: {} };
  }

  const config = loadConfig(env);

  return {
    hooks: {
      "session.idle": async (data: EventData) => {
        const project = getProjectName(data.cwd);
        await sendNotification(
          config,
          {
            title: `${project} - Session Idle`,
            message: `Event: session.idle\nProject: ${project}\nTime: ${new Date().toISOString()}`,
            tags: "hourglass_done",
          },
          fetchFn
        );
      },
      "session.error": async (data: EventData) => {
        const project = getProjectName(data.cwd);
        const errorMsg = data.error ? `\nError: ${data.error}` : "";
        await sendNotification(
          config,
          {
            title: `${project} - Session Error`,
            message: `Event: session.error\nProject: ${project}\nTime: ${new Date().toISOString()}${errorMsg}`,
            tags: "warning",
          },
          fetchFn
        );
      },
    },
  };
}
