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

  describe("trailing edge", () => {
    it("should reject the first call", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S", edge: "trailing" });
      expect(guard.shouldAllow("session.idle")).toBe(false);
    });

    it("should allow after the cooldown period has elapsed since the first call", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S", edge: "trailing" });
      guard.shouldAllow("session.idle");
      vi.advanceTimersByTime(5001);
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });

    it("should reject again immediately after an allowed trailing call", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S", edge: "trailing" });
      guard.shouldAllow("session.idle");
      vi.advanceTimersByTime(5001);
      guard.shouldAllow("session.idle"); // allowed
      expect(guard.shouldAllow("session.idle")).toBe(false);
    });

    it("should track different event types independently", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S", edge: "trailing" });
      guard.shouldAllow("session.idle");
      vi.advanceTimersByTime(5001);
      // session.idle is now allowed (cooldown elapsed)
      // session.error has never been called, so it starts fresh
      expect(guard.shouldAllow("session.idle")).toBe(true);
      expect(guard.shouldAllow("session.error")).toBe(false);
    });

    it("should reset the cooldown timer on each rejected call", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S", edge: "trailing" });
      guard.shouldAllow("session.idle"); // t=0, rejected, starts cooldown
      vi.advanceTimersByTime(3000); // t=3s
      guard.shouldAllow("session.idle"); // rejected, resets cooldown to t=3s
      vi.advanceTimersByTime(3000); // t=6s, only 3s since last call at t=3s
      expect(guard.shouldAllow("session.idle")).toBe(false); // rejected, resets to t=6s
      vi.advanceTimersByTime(5001); // t=11s, 5s+ since last call at t=6s
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });

    it("should allow all calls when cooldown is PT0S (disabled)", () => {
      const guard = createCooldownGuard({ cooldown: "PT0S", edge: "trailing" });
      expect(guard.shouldAllow("session.idle")).toBe(true);
      expect(guard.shouldAllow("session.idle")).toBe(true);
    });
  });

  describe("edge option defaults to leading", () => {
    it("should default to leading edge when edge is not specified", () => {
      const guard = createCooldownGuard({ cooldown: "PT5S" });
      // Leading edge allows the first call
      expect(guard.shouldAllow("session.idle")).toBe(true);
      expect(guard.shouldAllow("session.idle")).toBe(false);
    });
  });
});
