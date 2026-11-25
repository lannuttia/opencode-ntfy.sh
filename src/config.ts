import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, toSeconds } from "iso8601-duration";
import type { NotificationEvent } from "opencode-notification-sdk";

export interface ValueTemplate {
  readonly value: string;
}

export interface CommandTemplate {
  readonly command: string;
}

export type ContentTemplate = ValueTemplate | CommandTemplate;

export type ContentTemplateMap = Partial<
  Record<NotificationEvent, ContentTemplate>
>;

export interface NtfyBackendConfig {
  topic: string;
  server: string;
  token?: string;
  priority: string;
  iconUrl: string;
  fetchTimeout?: number;
  click?: string;
  title?: ContentTemplateMap;
  message?: ContentTemplateMap;
}

const VALID_PRIORITIES = ["min", "low", "default", "high", "max"] as const;
const VALID_EVENTS: readonly NotificationEvent[] = [
  "session.idle",
  "session.error",
  "permission.asked",
] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);
const PACKAGE_VERSION: string = pkg.version;

const BASE_ICON_URL = `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${PACKAGE_VERSION}/assets`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveIconUrl(
  iconMode: string,
  iconLight: string | undefined,
  iconDark: string | undefined
): string {
  const mode = iconMode === "light" ? "light" : "dark";
  if (mode === "light" && iconLight) return iconLight;
  if (mode === "dark" && iconDark) return iconDark;
  return `${BASE_ICON_URL}/opencode-icon-${mode}.png`;
}

function parseISO8601Duration(duration: string): number {
  try {
    const parsed = parse(duration);
    return Math.round(toSeconds(parsed) * 1000);
  } catch {
    throw new Error(
      `Invalid ISO 8601 duration: "${duration}". Expected format like PT30S, PT5M, PT1H30M15S.`
    );
  }
}

export function parseNtfyBackendConfig(
  raw: Record<string, unknown>
): NtfyBackendConfig {
  // Required: topic
  if (typeof raw.topic !== "string" || raw.topic.length === 0) {
    throw new Error("Backend config must contain a non-empty 'topic' string");
  }
  const topic = raw.topic;

  // Optional: server
  const server =
    typeof raw.server === "string" ? raw.server : "https://ntfy.sh";

  // Optional: token
  const token = typeof raw.token === "string" ? raw.token : undefined;

  // Optional: priority
  const priority =
    typeof raw.priority === "string" ? raw.priority : "default";
  if (!VALID_PRIORITIES.some((p) => p === priority)) {
    throw new Error(
      `Backend config 'priority' must be one of: ${VALID_PRIORITIES.join(", ")}`
    );
  }

  // Optional: icon object { mode, variant: { light, dark } }
  const iconObj = isRecord(raw.icon) ? raw.icon : {};
  const iconModeRaw =
    typeof iconObj.mode === "string" ? iconObj.mode : "dark";
  const iconMode =
    iconModeRaw === "light" || iconModeRaw === "dark"
      ? iconModeRaw
      : "dark";
  const variantObj = isRecord(iconObj.variant) ? iconObj.variant : {};
  const iconLight =
    typeof variantObj.light === "string" ? variantObj.light : undefined;
  const iconDark =
    typeof variantObj.dark === "string" ? variantObj.dark : undefined;
  const iconUrl = resolveIconUrl(iconMode, iconLight, iconDark);

  // Optional: fetchTimeout (ISO 8601 duration -> ms)
  const fetchTimeout =
    typeof raw.fetchTimeout === "string"
      ? parseISO8601Duration(raw.fetchTimeout)
      : undefined;

  // Optional: URL opened when the notification is tapped
  if (raw.click !== undefined && typeof raw.click !== "string") {
    throw new Error("Backend config 'click' must be a string");
  }
  const click = typeof raw.click === "string" ? raw.click : undefined;

  // Optional: title and message content templates
  const title = isRecord(raw.title)
    ? parseContentTemplateMap(raw.title, "title")
    : undefined;
  const message = isRecord(raw.message)
    ? parseContentTemplateMap(raw.message, "message")
    : undefined;

  return {
    topic,
    server,
    token,
    priority,
    iconUrl,
    fetchTimeout,
    click,
    title,
    message,
  };
}

function isValidEvent(key: string): key is NotificationEvent {
  return VALID_EVENTS.some((e) => e === key);
}

function parseContentTemplateMap(
  raw: Record<string, unknown>,
  fieldName: string
): ContentTemplateMap {
  const result: Partial<Record<NotificationEvent, ContentTemplate>> = {};
  for (const key of Object.keys(raw)) {
    if (!isValidEvent(key)) {
      throw new Error(
        `Invalid event type '${key}' in backend.${fieldName}. Valid events: ${VALID_EVENTS.join(", ")}`
      );
    }
    const entry = raw[key];
    if (!isRecord(entry)) {
      throw new Error(
        `backend.${fieldName}.${key} must be an object`
      );
    }
    const hasValue = typeof entry.value === "string";
    const hasCommand = typeof entry.command === "string";
    if (hasValue && hasCommand) {
      throw new Error(
        `backend.${fieldName}.${key} must contain exactly one of 'value' or 'command', not both`
      );
    }
    if (!hasValue && !hasCommand) {
      throw new Error(
        `backend.${fieldName}.${key} must contain exactly one of 'value' or 'command'`
      );
    }
    if (hasValue && typeof entry.value === "string") {
      result[key] = { value: entry.value };
    } else if (hasCommand && typeof entry.command === "string") {
      result[key] = { command: entry.command };
    }
  }
  return result;
}
