import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_DIRECTORY = join(tmpdir(), "opencode-ntfy-dedupe");

export interface EventDeduplicator {
  /** Returns true only for the first claim of this id within the TTL. */
  readonly claim: (id: string) => boolean;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function prune(directory: string, maxAgeMs: number): void {
  const now = Date.now();
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    try {
      const recorded = Number(readFileSync(file, "utf-8"));
      if (!Number.isFinite(recorded) || now - recorded > maxAgeMs) {
        unlinkSync(file);
      }
    } catch {
      // A concurrent writer or a non-claim file: leave it alone.
    }
  }
}

/**
 * Cross-instance dedupe for OpenCode server events.
 *
 * The same event is delivered to every plugin instance loaded from the global
 * config, so an in-memory Set per instance is not enough. Claim files in a
 * shared temp directory make the first instance to see an event the only one
 * that publishes it. Fail-open: filesystem problems never suppress a push.
 */
export function createEventDeduplicator(
  options: { directory?: string; ttlMs?: number } = {},
): EventDeduplicator {
  const directory = options.directory ?? DEFAULT_DIRECTORY;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  mkdirSync(directory, { recursive: true });
  prune(directory, ttlMs * 2);

  return {
    claim(id: string): boolean {
      const file = join(directory, encodeURIComponent(id));
      const now = Date.now();

      try {
        writeFileSync(file, String(now), { flag: "wx" });
        return true;
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "EEXIST") {
          return true; // fail open
        }
        try {
          const recorded = Number(readFileSync(file, "utf-8"));
          if (Number.isFinite(recorded) && now - recorded > ttlMs) {
            writeFileSync(file, String(now));
            return true;
          }
        } catch {
          return true; // fail open
        }
        return false;
      }
    },
  };
}
