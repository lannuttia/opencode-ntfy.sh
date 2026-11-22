import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventDeduplicator } from "../src/dedupe.js";

describe("createEventDeduplicator", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "opencode-ntfy-dedupe-test-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("claims an event only once", () => {
    const dedupe = createEventDeduplicator({ directory });

    expect(dedupe.claim("evt-1")).toBe(true);
    expect(dedupe.claim("evt-1")).toBe(false);
  });

  it("claims different events independently", () => {
    const dedupe = createEventDeduplicator({ directory });

    expect(dedupe.claim("evt-1")).toBe(true);
    expect(dedupe.claim("evt-2")).toBe(true);
  });

  it("reclaims an event whose claim has expired", () => {
    const dedupe = createEventDeduplicator({ directory, ttlMs: 1000 });
    expect(dedupe.claim("evt-3")).toBe(true);

    writeFileSync(
      join(directory, encodeURIComponent("evt-3")),
      String(Date.now() - 5000),
    );

    expect(dedupe.claim("evt-3")).toBe(true);
  });
});
