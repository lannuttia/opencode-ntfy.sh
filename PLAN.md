# Implementation Plan

## Phase 1: Project Scaffolding

- [ ] Initialize npm project with `package.json` (name: `opencode-ntfy.sh`, type: module, main/types entry points)
- [ ] Create `tsconfig.json` with strict TypeScript config targeting ESNext
- [ ] Create `vitest.config.ts`

## Phase 2: Core Implementation

- [ ] Implement `src/config.ts` - read and validate environment variables (`NTFY_TOPIC`, `NTFY_SERVER`, `NTFY_TOKEN`, `NTFY_PRIORITY`)
- [ ] Implement `src/notify.ts` - HTTP client that sends POST requests to ntfy.sh
- [ ] Implement `src/index.ts` - OpenCode plugin export with `session.idle` and `session.error` event hooks

## Phase 3: Tests

- [ ] Write tests for `src/config.ts` - valid config, missing topic, defaults, custom server
- [ ] Write tests for `src/notify.ts` - successful send, auth header, error handling
- [ ] Write tests for `src/index.ts` - plugin hooks fire notifications correctly

## Phase 4: Polish

- [ ] Verify all tests pass
- [ ] Verify the package builds cleanly
