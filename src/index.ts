import { Plugin } from "@opencode/plugin";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { basename } from "node:path";
import { parseNtfyBackendConfig } from "./config.js";
import { createNtfyBackend } from "./backend.js";

const NOTIFICATION_EVENTS = [
  "session.idle",
  "session.error",
  "permission.asked",
] as const;

type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

interface EventConfig {
  enabled: boolean;
}

interface NotificationSDKConfig {
  enabled: boolean;
  events: Record<NotificationEvent, EventConfig>;
  backend: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfigPath(): string {
  return join(homedir(), ".config", "opencode", "notification-ntfy.json");
}

function substituteString(value: string, configDir: string): string {
  const envSubstituted = value.replace(/\{env:([^}]+)\}/g, (_match, varName: string) => {
    return process.env[varName] ?? "";
  });
  return envSubstituted.replace(/\{file:([^}]+)\}/g, (_match, filePath: string) => {
    const resolvedPath = filePath.startsWith("/")
      ? filePath
      : filePath.startsWith("~")
        ? join(homedir(), filePath.slice(1))
        : join(configDir, filePath);
    try {
      return readFileSync(resolvedPath, "utf-8").trim();
    } catch {
      return "";
    }
  });
}

function substituteVariables(value: unknown, configDir: string): unknown {
  if (typeof value === "string") {
    return substituteString(value, configDir);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => substituteVariables(item, configDir));
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = substituteVariables(value[key], configDir);
    }
    return result;
  }
  return value;
}

function createDefaultConfig(): NotificationSDKConfig {
  return {
    enabled: true,
    events: {
      "session.idle": { enabled: true },
      "session.error": { enabled: true },
      "permission.asked": { enabled: true },
    },
    backend: {},
  };
}

function loadConfig(): NotificationSDKConfig {
  const configPath = getConfigPath();
  try {
    const content = readFileSync(configPath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Invalid notification config: ${message}`);
    }
    if (!isRecord(parsed)) {
      throw new Error("Invalid notification config: expected a JSON object");
    }
    const substituted = substituteVariables(parsed, dirname(configPath));
    if (!isRecord(substituted)) {
      throw new Error("Invalid notification config: expected a JSON object");
    }
    const defaults = createDefaultConfig();
    const enabled =
      typeof substituted.enabled === "boolean" ? substituted.enabled : defaults.enabled;
    const events = { ...defaults.events };
    if (isRecord(substituted.events)) {
      for (const key of NOTIFICATION_EVENTS) {
        const eventVal = substituted.events[key];
        if (isRecord(eventVal) && typeof eventVal.enabled === "boolean") {
          events[key] = { enabled: eventVal.enabled };
        }
      }
    }
    let backend = defaults.backend;
    if (isRecord(substituted.backend)) {
      backend = { ...substituted.backend };
    }
    return { enabled, events, backend };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return createDefaultConfig();
    }
    throw error;
  }
}

export default Plugin.define({
  id: "opencode-ntfy.sh",
  setup(ctx) {
    const config = loadConfig();
    const backendConfig = parseNtfyBackendConfig(config.backend);
    const backend = createNtfyBackend(backendConfig);
    const projectName = basename(ctx.location.directory);

    const controller = new AbortController();

    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (!config.enabled) {
          continue;
        }

        if (event.type === "permission.asked") {
          const notificationEvent: NotificationEvent = "permission.asked";
          if (!config.events[notificationEvent].enabled) {
            continue;
          }
          const sessionID = event.data.sessionID;
          const permType = event.data.action;
          const patterns = event.data.resources;
          const metadata = {
            sessionId: sessionID,
            projectName,
            timestamp: new Date().toISOString(),
            permissionType: permType,
            permissionPatterns: patterns,
          };
          try {
            await backend.send({ event: notificationEvent, metadata });
          } catch {
            // Silently ignore send errors
          }
          continue;
        }

        if (event.type === "session.idle") {
          const notificationEvent: NotificationEvent = "session.idle";
          if (!config.events[notificationEvent].enabled) {
            continue;
          }
          const sessionID = event.data.sessionID;
          // Subagent suppression: skip child sessions
          try {
            const session = await ctx.session.get({ sessionID });
            if (session.parentID) {
              continue;
            }
          } catch {
            // Fail-open: send notification if session lookup fails
          }
          const metadata = {
            sessionId: sessionID,
            projectName,
            timestamp: new Date().toISOString(),
          };
          try {
            await backend.send({ event: notificationEvent, metadata });
          } catch {
            // Silently ignore send errors
          }
          continue;
        }

        if (event.type === "session.execution.failed") {
          const notificationEvent: NotificationEvent = "session.error";
          if (!config.events[notificationEvent].enabled) {
            continue;
          }
          const sessionID = event.data.sessionID;
          // Subagent suppression: skip child sessions
          try {
            const session = await ctx.session.get({ sessionID });
            if (session.parentID) {
              continue;
            }
          } catch {
            // Fail-open: send notification if session lookup fails
          }
          const metadata = {
            sessionId: sessionID,
            projectName,
            timestamp: new Date().toISOString(),
            error: event.data.error.message,
          };
          try {
            await backend.send({ event: notificationEvent, metadata });
          } catch {
            // Silently ignore send errors
          }
        }
      }
    })();

    return () => controller.abort();
  },
});
