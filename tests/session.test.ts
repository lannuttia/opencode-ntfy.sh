import { describe, expect, it, vi } from "vitest";
import { lookupSession } from "../src/session.js";

function makeContext(session: {
  parentID?: string;
  title?: string;
}) {
  return {
    session: {
      get: vi.fn().mockResolvedValue(session),
    },
  };
}

describe("lookupSession", () => {
  it("returns the session title and parent ID", async () => {
    const ctx = makeContext({ title: "Fix login", parentID: "ses_parent" });

    await expect(lookupSession(ctx, "ses_child")).resolves.toEqual({
      title: "Fix login",
      parentID: "ses_parent",
    });
    expect(ctx.session.get).toHaveBeenCalledWith({ sessionID: "ses_child" });
  });

  it("does not call the API without a session ID", async () => {
    const ctx = makeContext({ title: "Fix login" });

    await expect(lookupSession(ctx, "")).resolves.toBeUndefined();
    expect(ctx.session.get).not.toHaveBeenCalled();
  });

  it("fails open when the session lookup fails", async () => {
    const ctx = {
      session: {
        get: vi.fn().mockRejectedValue(new Error("not found")),
      },
    };

    await expect(lookupSession(ctx, "ses_missing")).resolves.toBeUndefined();
  });
});
