import { loadConfig } from "./config.js";
import { sendNotification } from "./notify.js";

type FetchFn = typeof globalThis.fetch;

interface PluginInput {
  directory: string;
  env?: Record<string, string | undefined>;
  fetchFn?: FetchFn;
}

interface Hooks {
  event?: (input: { event: { type: string; properties: Record<string, unknown> } }) => Promise<void>;
}

function getProjectName(directory: string): string {
  return directory.split("/").pop() || directory;
}

export async function plugin(input: PluginInput): Promise<Hooks> {
  const env = input.env ?? process.env;

  if (!env.NTFY_TOPIC) {
    return {};
  }

  const config = loadConfig(env);

  const fetchFn = input.fetchFn;
  const project = getProjectName(input.directory);

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await sendNotification(
          config,
          {
            title: `${project} - Session Idle`,
            message: `Event: session.idle\nProject: ${project}\nTime: ${new Date().toISOString()}`,
            tags: "hourglass_done",
          },
          fetchFn
        );
      }
    },
  };
}
