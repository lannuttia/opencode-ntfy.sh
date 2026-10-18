import { execSync } from "node:child_process";
import type {
  NotificationBackend,
  NotificationContext,
  NotificationEvent,
} from "opencode-notification-sdk";
import { renderTemplate } from "opencode-notification-sdk";
import type {
  NtfyBackendConfig,
  ContentTemplate,
  ContentTemplateMap,
} from "./config.js";

const DEFAULT_TITLES: Record<NotificationEvent, string> = {
  "session.idle": "Agent Idle",
  "session.error": "Agent Error",
  "permission.asked": "Permission Asked",
};

const DEFAULT_MESSAGES: Record<NotificationEvent, string> = {
  "session.idle": "The agent has finished and is waiting for input.",
  "session.error": "An error has occurred. Check the session for details.",
  "permission.asked":
    "The agent needs permission to continue. Review and respond.",
};

const DEFAULT_TAGS: Record<NotificationEvent, string> = {
  "session.idle": "hourglass_done",
  "session.error": "warning",
  "permission.asked": "lock",
};

function isValueTemplate(
  template: ContentTemplate
): template is { readonly value: string } {
  return "value" in template;
}

function execTemplate(
  command: string,
  context: NotificationContext
): string {
  const rendered = renderTemplate(command, context);
  const stdout = execSync(rendered, { encoding: "utf-8" });
  return stdout.trim();
}

function resolveContent(
  templateMap: ContentTemplateMap | undefined,
  event: NotificationEvent,
  defaults: Record<NotificationEvent, string>,
  context: NotificationContext
): string {
  const template = templateMap?.[event];
  if (!template) {
    return defaults[event] ?? "";
  }
  if (isValueTemplate(template)) {
    return renderTemplate(template.value, context);
  }
  // command template
  return execTemplate(template.command, context);
}

export function createNtfyBackend(
  config: NtfyBackendConfig
): NotificationBackend {
  return {
    async send(context: NotificationContext): Promise<void> {
      const url = `${config.server}/${config.topic}`;

      const title = resolveContent(
        config.title,
        context.event,
        DEFAULT_TITLES,
        context
      );
      const message = resolveContent(
        config.message,
        context.event,
        DEFAULT_MESSAGES,
        context
      );
      const tags = DEFAULT_TAGS[context.event] ?? "";

      const headers: Record<string, string> = {
        Title: title,
        Priority: config.priority,
        Tags: tags,
        "X-Icon": config.iconUrl,
        ...(config.token
          ? { Authorization: `Bearer ${config.token}` }
          : {}),
      };

      const fetchOptions: RequestInit = {
        method: "POST",
        headers,
        body: message,
        ...(config.fetchTimeout !== undefined
          ? { signal: AbortSignal.timeout(config.fetchTimeout) }
          : {}),
      };

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(
          `ntfy request failed: ${response.status} ${response.statusText}`
        );
      }
    },
  };
}
