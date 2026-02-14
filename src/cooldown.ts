const ISO8601_DURATION_PATTERN = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/;

export function parseISO8601Duration(duration: string): number {
  const match = ISO8601_DURATION_PATTERN.exec(duration);
  if (!match) {
    throw new Error(
      `Invalid ISO 8601 duration: "${duration}". Expected format like PT30S, PT5M, PT1H30M15S.`
    );
  }

  const hours = parseFloat(match[1] || "0");
  const minutes = parseFloat(match[2] || "0");
  const seconds = parseFloat(match[3] || "0");

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
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
  const lastSeen = new Map<string, number>();

  return {
    shouldAllow(eventType: string): boolean {
      if (cooldownMs <= 0) {
        return true;
      }

      const now = Date.now();
      const last = lastSeen.get(eventType);

      if (edge === "leading") {
        if (last !== undefined && now - last <= cooldownMs) {
          return false;
        }
        lastSeen.set(eventType, now);
        return true;
      }

      // trailing edge
      if (last === undefined) {
        lastSeen.set(eventType, now);
        return false;
      }

      if (now - last <= cooldownMs) {
        lastSeen.set(eventType, now);
        return false;
      }

      lastSeen.set(eventType, now);
      return true;
    },
  };
}
