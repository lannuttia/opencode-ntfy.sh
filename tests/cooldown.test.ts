import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCooldownGuard, parseISO8601Duration } from "../src/cooldown.js";

describe("parseISO8601Duration", () => {
  it("should parse seconds", () => {
    expect(parseISO8601Duration("PT5S")).toBe(5000);
  });

  it("should parse minutes", () => {
    expect(parseISO8601Duration("PT2M")).toBe(120000);
  });

  it("should parse hours", () => {
    expect(parseISO8601Duration("PT1H")).toBe(3600000);
  });

  it("should parse combined hours, minutes, and seconds", () => {
    expect(parseISO8601Duration("PT1H30M15S")).toBe(5415000);
  });

  it("should parse minutes and seconds", () => {
    expect(parseISO8601Duration("PT5M30S")).toBe(330000);
  });

  it("should return 0 for PT0S", () => {
    expect(parseISO8601Duration("PT0S")).toBe(0);
  });

  it("should throw for invalid duration strings", () => {
    expect(() => parseISO8601Duration("5000")).toThrow();
    expect(() => parseISO8601Duration("invalid")).toThrow();
    expect(() => parseISO8601Duration("")).toThrow();
  });

  it("should parse fractional seconds", () => {
    expect(parseISO8601Duration("PT1.5S")).toBe(1500);
  });
});

describe("cooldown guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("leading edge (default)", () => {
    it("should allow the first call", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });

    it("should reject a second call within the cooldown period", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      guard.shouldAllow("session.idle");
      expect(guard.shouldAllow("session.idle")).toBe(false);
    });

    it("should allow a call after the cooldown period has elapsed", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      guard.shouldAllow("session.idle");
      vi.advanceTimersByTime(5001);
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });

    it("should track different event types independently", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      guard.shouldAllow("session.idle");
      expect(guard.shouldAllow("session.error")).toBe(true);
    });

    it("should reject at the exact cooldown boundary", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      guard.shouldAllow("session.idle");
      vi.advanceTimersByTime(5000);
      expect(guard.shouldAllow("session.idle")).toBe(false);
    });

    it("should allow all calls when cooldown is PT0S (disabled)", () => {
      const guard = createCooldownGuard({ cooldown: "PT0S" });
      expect(guard.shouldAllow("session.idle")).toBe(true);
      expect(guard.shouldAllow("session.idle")).toBe(true);
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });
  });
});
