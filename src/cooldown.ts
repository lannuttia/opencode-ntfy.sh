import { parse, toSeconds } from "iso8601-duration";
import { throttle, debounce } from "throttle-debounce";

export function parseISO8601Duration(duration: string): number {
  let parsed;
  try {
    parsed = parse(duration);
  } catch {
    throw new Error(
      `Invalid ISO 8601 duration: "${duration}". Expected format like PT30S, PT5M, PT1H30M15S.`
    );
  }
  return Math.round(toSeconds(parsed) * 1000);
}

export interface CooldownOptions {
  cooldown: string;
  edge?: "leading" | "trailing";
}

export interface CooldownGuard {
  shouldAllow(eventType: string): boolean;
}

export function createCooldownGuard(options: CooldownOptions): CooldownGuard {
  const cooldownMs = parseISO8601Duration(options.cooldown);
  const edge = options.edge ?? "leading";
  const gates = new Map<string, { allowed: boolean; trigger: () => void }>();

  function getGate(eventType: string): { allowed: boolean; trigger: () => void } {
    const existing = gates.get(eventType);
    if (existing) {
      return existing;
    }

    const gate = { allowed: false, trigger: (): void => {} };

    if (edge === "leading") {
      const throttled = throttle(cooldownMs, () => {
        gate.allowed = true;
      }, { noTrailing: true });
      gate.trigger = throttled;
    } else {
      const debounced = debounce(cooldownMs, () => {
        gate.allowed = true;
      });
      gate.trigger = debounced;
    }

    gates.set(eventType, gate);
    return gate;
  }

  return {
    shouldAllow(eventType: string): boolean {
      if (cooldownMs <= 0) {
        return true;
      }

      const gate = getGate(eventType);

      if (edge === "leading") {
        gate.allowed = false;
        gate.trigger();
        return gate.allowed;
      }

      // trailing edge
      const wasAllowed = gate.allowed;
      if (wasAllowed) {
        gate.allowed = false;
      }
      gate.trigger();
      return wasAllowed;
    },
  };
}
