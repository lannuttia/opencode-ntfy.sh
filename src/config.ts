import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseISO8601Duration } from "./cooldown.js";

export interface NtfyConfig {
  topic: string;
  server: string;
  token?: string;
  priority: string;
  iconUrl: string;
  cooldown?: string;
  cooldownEdge?: "leading" | "trailing";
  fetchTimeout?: number;
}

const VALID_PRIORITIES = ["min", "low", "default", "high", "max"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);
const PACKAGE_VERSION: string = pkg.version;

const BASE_ICON_URL = `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${PACKAGE_VERSION}/assets`;

function resolveIconUrl(env: Record<string, string | undefined>): string {
  const mode = env.OPENCODE_NTFY_ICON_MODE === "light" ? "light" : "dark";
  const override = env[`OPENCODE_NTFY_ICON_${mode.toUpperCase()}`];
  return override || `${BASE_ICON_URL}/opencode-icon-${mode}.png`;
}

export function loadConfig(
  env: Record<string, string | undefined>
): NtfyConfig {
  const topic = env.OPENCODE_NTFY_TOPIC;
  if (!topic) {
    throw new Error("OPENCODE_NTFY_TOPIC environment variable is required");
  }

  const priority = env.OPENCODE_NTFY_PRIORITY || "default";
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(
      `OPENCODE_NTFY_PRIORITY must be one of: ${VALID_PRIORITIES.join(", ")}`
    );
  }

  const cooldown = env.OPENCODE_NTFY_COOLDOWN;
  if (cooldown) {
    // Validate the duration string by parsing it; throws on invalid format
    parseISO8601Duration(cooldown);
  }

  const cooldownEdge = parseCooldownEdge(env.OPENCODE_NTFY_COOLDOWN_EDGE);

  const fetchTimeout = env.OPENCODE_NTFY_FETCH_TIMEOUT
    ? parseISO8601Duration(env.OPENCODE_NTFY_FETCH_TIMEOUT)
    : undefined;

  return {
    topic,
    server: env.OPENCODE_NTFY_SERVER || "https://ntfy.sh",
    token: env.OPENCODE_NTFY_TOKEN,
    priority,
    iconUrl: resolveIconUrl(env),
    cooldown: cooldown || undefined,
    cooldownEdge,
    fetchTimeout,
  };
}

function parseCooldownEdge(
  value: string | undefined
): "leading" | "trailing" | undefined {
  if (!value) return undefined;
  if (value === "leading" || value === "trailing") return value;
  throw new Error(
    "OPENCODE_NTFY_COOLDOWN_EDGE must be one of: leading, trailing"
  );
}
