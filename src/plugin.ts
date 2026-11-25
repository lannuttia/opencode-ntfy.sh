import { basename } from "node:path";
import { Plugin } from "@opencode/plugin";
import type {
  EventMetadata,
  NotificationEvent,
} from "opencode-notification-sdk";
import { getBackendConfig, loadConfig } from "opencode-notification-sdk";
import { createNtfyBackend } from "./backend.js";
import { parseNtfyBackendConfig } from "./config.js";
import { createEventDeduplicator } from "./dedupe.js";
import { lookupSession, type SessionSummary } from "./session.js";

type NtfyEventMetadata = EventMetadata & { sessionTitle?: string };

const config = loadConfig("ntfy");
const backend = createNtfyBackend(
  parseNtfyBackendConfig(getBackendConfig(config, "ntfy")),
);
const dedupe = createEventDeduplicator();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventData(event: unknown): Record<string, unknown> {
  if (!isRecord(event) || !isRecord(event.data)) return {};
  return event.data;
}

function eventId(event: unknown): string | undefined {
  if (!isRecord(event) || typeof event.id !== "string") return undefined;
  return event.id;
}

function metadata(
  sessionId: string,
  projectName: string,
  extra: Partial<NtfyEventMetadata> = {},
): NtfyEventMetadata {
  return {
    sessionId,
    projectName,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function sessionMetadata(
  session: SessionSummary | undefined,
): Partial<NtfyEventMetadata> {
  return session?.title ? { sessionTitle: session.title } : {};
}

export default Plugin.define({
  id: "opencode-notification-ntfy",
  setup(ctx) {
    const controller = new AbortController();
    const projectName = basename(ctx.location.directory);
    const enabled = (event: NotificationEvent): boolean =>
      config.enabled && config.events?.[event]?.enabled !== false;

    const send = async (
      event: NotificationEvent,
      meta: NtfyEventMetadata,
      id: string | undefined,
    ): Promise<void> => {
      if (id !== undefined && !dedupe.claim(id)) return;
      try {
        await backend.send({ event, metadata: meta });
      } catch {
        // Notifications must never break the host process.
      }
    };

    void (async () => {
      for await (const event of ctx.event.subscribe({
        signal: controller.signal,
      })) {
        const data = eventData(event);
        const id = eventId(event);
        const sessionId =
          typeof data.sessionID === "string" ? data.sessionID : "";
        const type = String(event.type);

        if (
          type === "session.execution.succeeded" ||
          (type === "session.status" &&
            isRecord(data.status) &&
            data.status.type === "idle")
        ) {
          if (!enabled("session.idle")) continue;
          const session = await lookupSession(ctx, sessionId);
          if (session?.parentID) continue;
          await send(
            "session.idle",
            metadata(sessionId, projectName, sessionMetadata(session)),
            id,
          );
          continue;
        }

        if (type === "session.execution.failed") {
          if (!enabled("session.error")) continue;
          const session = await lookupSession(ctx, sessionId);
          if (session?.parentID) continue;
          const error =
            isRecord(data.error) && typeof data.error.message === "string"
              ? data.error.message
              : undefined;
          await send(
            "session.error",
            metadata(sessionId, projectName, {
              ...sessionMetadata(session),
              ...(error ? { error } : {}),
            }),
            id,
          );
          continue;
        }

        if (type === "permission.asked") {
          if (!enabled("permission.asked")) continue;
          const session = await lookupSession(ctx, sessionId);
          const patterns = Array.isArray(data.resources)
            ? data.resources.filter(
                (resource): resource is string => typeof resource === "string",
              )
            : [];
          await send(
            "permission.asked",
            metadata(sessionId, projectName, {
              ...sessionMetadata(session),
              permissionType:
                typeof data.action === "string" ? data.action : "",
              permissionPatterns: patterns,
            }),
            id,
          );
        }
      }
    })();

    return () => controller.abort();
  },
});
