# Implementation Plan

## Phase 1: Project Scaffolding

- [x] Initialize npm project with `package.json` (name: `opencode-ntfy.sh`, type: module, main/types entry points)
- [x] Create `tsconfig.json` with strict TypeScript config targeting ESNext
- [x] Create `vitest.config.ts`

## Phase 2: Core Implementation

- [x] Implement `src/config.ts` - read and validate environment variables (`NTFY_TOPIC`, `NTFY_SERVER`, `NTFY_TOKEN`, `NTFY_PRIORITY`)
- [x] Implement `src/notify.ts` - HTTP client that sends POST requests to ntfy.sh
- [x] Implement `src/index.ts` - OpenCode plugin export with `session.idle` and `session.error` event hooks

## Phase 3: Tests

- [x] Write tests for `src/config.ts` - valid config, missing topic, defaults, custom server
- [x] Write tests for `src/notify.ts` - successful send, auth header, error handling
- [x] Write tests for `src/index.ts` - plugin hooks fire notifications correctly

## Phase 4: Polish

- [x] Verify all tests pass
- [x] Verify the package builds cleanly (added `@types/node` dev dependency)

## Phase 5: Conform to OpenCode Plugin API

- [x] Rewrite `src/index.ts` to match the `@opencode-ai/plugin` `Plugin` type signature: `(input: PluginInput) => Promise<Hooks>`
- [x] Use the `event` hook in `Hooks` to listen for `session.idle` and `session.error` events from the `Event` union type
- [x] Derive project name from `PluginInput.directory` instead of per-event `cwd`
- [x] Extract error messages from `EventSessionError.properties.error` union type
- [x] Export the plugin as the default export
- [x] Rewrite `tests/plugin.test.ts` to test the new interface
- [x] Ensure all tests pass and package builds cleanly

## Phase 6: Import Real `@opencode-ai/plugin` Types

- [x] Add `@opencode-ai/plugin` as a dev dependency
- [x] Import `Plugin`, `PluginInput`, and `Hooks` types from `@opencode-ai/plugin` in `src/index.ts` (replacing hand-rolled types)
- [x] Remove custom `fetchFn` parameter from `sendNotification` — use `globalThis.fetch` directly
- [x] Remove custom `env` and `fetchFn` from plugin input — read `process.env` directly
- [x] Update `tests/notify.test.ts` to mock `globalThis.fetch` via `vi.stubGlobal`
- [x] Update `tests/plugin.test.ts` to use real `PluginInput` shape and `vi.stubEnv`/`vi.stubGlobal`
- [x] Add `tests/typecheck.test.ts` with compile-time type conformance checks
- [x] Ensure all tests pass and package builds cleanly
