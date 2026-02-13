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

## Phase 9: CI/CD with GitHub Actions

- [x] Create `.github/workflows/ci.yml` with test and build jobs that run on push and pull requests
- [x] Add publish job that publishes to https://registry.npmjs.org/ when a version tag is pushed
- [x] Write tests to verify CI workflow structure and correctness
- [x] Ensure all tests pass and package builds cleanly

## Phase 10: Fix Test Isolation & npm Provenance Attestation via OIDC

- [x] Fix `plugin.test.ts` env isolation: stub `NTFY_TOPIC` to empty string in "not set" tests to prevent host env leakage
- [x] Add `permissions: { id-token: write, contents: read }` to publish job
- [x] Use `npm publish --provenance --access public` instead of plain `npm publish`
- [x] Set `NODE_AUTH_TOKEN` to `secrets.NPM_TOKEN` in the publish step
- [x] Add `repository` field to `package.json` (required for provenance attestations)
- [x] Update CI tests to validate OIDC permissions, `--provenance` flag, `NODE_AUTH_TOKEN`, and repository field
- [x] Ensure all tests pass and package builds cleanly

## Phase 11: Add prepublishOnly Hook

- [x] Add `prepublishOnly` script to `package.json` that runs `npm run build` so the package is built automatically before publishing
- [x] Write test to verify the `prepublishOnly` script exists and builds the package
- [x] Ensure all tests pass and package builds cleanly
