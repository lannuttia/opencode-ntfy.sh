import type {
  NotificationBackend,
  NotificationContext,
  NotificationEvent,
} from "opencode-notification-sdk";
import { renderTemplate, execTemplate } from "opencode-notification-sdk";
import type {
  NtfyBackendConfig,
  ContentTemplate,
  ContentTemplateMap,
} from "./config.js";

// Minimal Bun shell interface — structurally compatible with the BunShell type
// in opencode-notification-sdk, which is not re-exported from the package index.
export interface BunShellOutput {
  readonly exitCode: number;
  text(): string;
}
export interface BunShellPromise extends Promise<BunShellOutput> {
  nothrow(): BunShellPromise;
  quiet(): BunShellPromise;
}
export interface BunShell {
  (strings: TemplateStringsArray, ...expressions: unknown[]): BunShellPromise;
}

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

async function resolveContent(
  templateMap: ContentTemplateMap | undefined,
  event: NotificationEvent,
  defaults: Record<NotificationEvent, string>,
  context: NotificationContext,
  $?: BunShell
): Promise<string> {
  const template = templateMap?.[event];
  if (!template) {
    return defaults[event] ?? "";
  }
  if (isValueTemplate(template)) {
    return renderTemplate(template.value, context);
  }
  // command template
  if (!$) {
    throw new Error(
      `Command template configured for ${event} but no shell ($) was provided`
    );
  }
  return execTemplate($, template.command, context);
}

export function createNtfyBackend(
  config: NtfyBackendConfig,
  $?: BunShell
): NotificationBackend {
  return {
    async send(context: NotificationContext): Promise<void> {
      const url = `${config.server}/${config.topic}`;

      const title = await resolveContent(
        config.title,
        context.event,
        DEFAULT_TITLES,
        context,
        $
      );
      const message = await resolveContent(
        config.message,
        context.event,
        DEFAULT_MESSAGES,
        context,
        $
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
