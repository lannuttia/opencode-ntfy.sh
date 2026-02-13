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

## Phase 7: Cleanup & Hardening

- [x] Exclude `_typecheck_*` temp files from `tsconfig.json` build to prevent polluting `dist/`
- [x] Add `src/_typecheck_*` to `.gitignore` to prevent stray files from being committed
- [x] Remove stray `src/_typecheck_plugin.ts` artifact and its `dist/` output
- [x] Add test to verify `_typecheck_*` files are not compiled into `dist/`
- [x] Ensure all tests pass and package builds cleanly

## Phase 8: Add `permission.asked` Event Support

- [x] Add `permission.ask` hook to send a notification when the agent requests permission
- [x] Include event type, project name, timestamp, and permission title in the notification
- [x] Write tests for the `permission.ask` hook in `tests/plugin.test.ts`
- [x] Ensure all tests pass and package builds cleanly

## Phase 9: Fix Test Isolation

- [x] Fix `plugin.test.ts` env isolation: stub `NTFY_TOPIC` to empty string in "not set" tests to prevent host env leakage

## Phase 10: Rename Environment Variables to `OPENCODE_NTFY_*`

- [ ] Rename `NTFY_TOPIC` → `OPENCODE_NTFY_TOPIC` in `src/config.ts` and all tests
- [ ] Rename `NTFY_SERVER` → `OPENCODE_NTFY_SERVER` in `src/config.ts` and all tests
- [ ] Rename `NTFY_TOKEN` → `OPENCODE_NTFY_TOKEN` in `src/config.ts` and all tests
- [ ] Rename `NTFY_PRIORITY` → `OPENCODE_NTFY_PRIORITY` in `src/config.ts` and all tests
- [ ] Ensure all tests pass and package builds cleanly

## Phase 11: Add `priority` Field to `NotificationPayload`

- [ ] Add optional `priority` field to `NotificationPayload` in `src/notify.ts`
- [ ] Update `sendNotification` to use `payload.priority` when set, falling back to `config.priority`
- [ ] Write tests for per-notification priority override
- [ ] Ensure all tests pass and package builds cleanly

## Phase 12: Implement `src/exec.ts` — Command Execution and Template Variable Substitution

- [ ] Create `src/exec.ts` with a `resolveField` function that:
  1. Takes the Bun `$` shell, a command template string (or `undefined`), a variables record, and a fallback default value
  2. If the command template is `undefined` or empty, returns the fallback
  3. Substitutes all `${VAR_NAME}` placeholders in the command with values from the variables record
  4. Executes the substituted command via the Bun `$` shell, capturing stdout
  5. Returns the trimmed stdout if the command succeeds
  6. Returns the fallback value if the command fails (non-zero exit, exception, etc.)
- [ ] Write tests for `resolveField` in `tests/exec.test.ts`
- [ ] Ensure all tests pass and package builds cleanly

## Phase 13: Wire Up Custom Notification Commands in Plugin

- [ ] Build template variables record per event (PROJECT, EVENT, TIME, ERROR, PERMISSION_TYPE, PERMISSION_PATTERNS)
- [ ] Use `resolveField` to resolve title, message, tags, and priority per event from environment variable commands
- [ ] Use the correct per-event env var names (e.g., `OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD`)
- [ ] Update `tests/plugin.test.ts` with tests for custom commands
- [ ] Ensure all tests pass and package builds cleanly
