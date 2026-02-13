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

- [ ] Rewrite `src/index.ts` to match the `@opencode-ai/plugin` `Plugin` type signature: `(input: PluginInput) => Promise<Hooks>`
- [ ] Use the `event` hook in `Hooks` to listen for `session.idle` and `session.error` events from the `Event` union type
- [ ] Derive project name from `PluginInput.directory` instead of per-event `cwd`
- [ ] Extract error messages from `EventSessionError.properties.error` union type
- [ ] Export the plugin as the default export
- [ ] Rewrite `tests/plugin.test.ts` to test the new interface
- [ ] Ensure all tests pass and package builds cleanly
