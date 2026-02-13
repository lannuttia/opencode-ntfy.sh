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

  return {
    event: async ({ event }) => {
      // Event handling will be implemented in subsequent increments
    },
  };
}
