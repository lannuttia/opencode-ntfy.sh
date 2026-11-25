export interface SessionSummary {
  readonly parentID?: string;
  readonly title?: string;
}

export async function lookupSession(
  ctx: {
    session: {
      get: (input: { sessionID: string }) => Promise<SessionSummary>;
    };
  },
  sessionId: string,
): Promise<SessionSummary | undefined> {
  if (!sessionId) return undefined;

  try {
    return await ctx.session.get({ sessionID: sessionId });
  } catch {
    return undefined; // fail open, like the upstream SDK
  }
}
