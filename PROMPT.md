# opencode-ntfy.sh

You are building an OpenCode plugin that sends push notifications via ntfy.sh.

## Goal

Build a TypeScript OpenCode plugin (`opencode-ntfy.sh`) that sends push notifications to a user's phone or desktop via the ntfy.sh service when key events occur during an OpenCode session.

## Instructions

1. Read the PLAN.md to understand the current state of implementation.
2. If all items in PLAN.md are complete and match this prompt's specifications, output exactly `<promise>Done</promise>` and stop. Do not make any changes.
3. Pick the SINGLE highest priority incomplete item from PLAN.md and implement it.
4. Ensure tests pass after your changes.
5. Update PLAN.md with your progress and commit all changes with `git add -A && git commit -m "..."`.

If there is a discrepancy between PLAN.md and this prompt, always update PLAN.md to match this prompt.

### Code Quality Rules

- **No type casting.** Never use `as`, `as any`, `as unknown`, or similar type assertions. If the types don't align, fix the type definitions or use type guards, generics, or proper type narrowing instead. This is enforced by ESLint via the `@typescript-eslint/consistent-type-assertions` rule with `assertionStyle: "never"`.
- **Linting is required.** All source and test code must pass `npm run lint` before committing. The linter uses ESLint with typescript-eslint and is configured in `eslint.config.js`.

## Specifications

### Plugin Behavior

- The plugin must be installable via npm or by placing it in `.opencode/plugins/`.
- The plugin must send ntfy.sh notifications on the following events via the `event` hook:
  - `session.idle` -- when the agent finishes and is waiting for input
  - `session.error` -- when a session encounters an error
  - `permission.asked` -- when the agent needs permission to perform an action
- Default notifications must include:
  - The event type
  - The project name (derived from the working directory)
  - A timestamp
  - For errors: the error message
  - For permissions: the permission type and patterns
- The plugin must be configurable via environment variables:
  - `OPENCODE_NTFY_TOPIC` (required) -- the ntfy.sh topic to publish to
  - `OPENCODE_NTFY_SERVER` (optional, defaults to `https://ntfy.sh`) -- the ntfy.sh server URL
  - `OPENCODE_NTFY_TOKEN` (optional) -- bearer token for authentication
  - `OPENCODE_NTFY_PRIORITY` (optional, defaults to `default`) -- global notification priority (min, low, default, high, max)
  - `OPENCODE_NTFY_ICON_MODE` (optional, defaults to `dark`) -- whether the target device uses `light` or `dark` mode
  - `OPENCODE_NTFY_ICON_LIGHT` (optional) -- custom icon URL override for light mode
  - `OPENCODE_NTFY_ICON_DARK` (optional) -- custom icon URL override for dark mode
  - `OPENCODE_NTFY_COOLDOWN` (optional) -- ISO 8601 duration for notification cooldown (e.g., `PT30S`, `PT5M`). When set, duplicate notifications for the same event type are suppressed within the cooldown period. When not set, no rate limiting is applied.
  - `OPENCODE_NTFY_COOLDOWN_EDGE` (optional, defaults to `leading`) -- which edge of the cooldown window triggers the notification. `leading` sends the first notification immediately and suppresses duplicates for the cooldown period. `trailing` suppresses the first notification and allows one after the cooldown period of inactivity.
  - `OPENCODE_NTFY_FETCH_TIMEOUT` (optional) -- ISO 8601 duration for the HTTP request timeout when calling the ntfy.sh server (e.g., `PT10S` for 10 seconds, `PT1M` for 1 minute). The duration is parsed using the same `parseISO8601Duration()` function from `src/cooldown.ts`. When set, the `fetch` call in `sendNotification` uses an `AbortSignal.timeout()` to enforce the timeout. When not set, no timeout is applied (the request uses the default `fetch` behavior).

### Custom Notification Commands

Each notification field (title, message, tags, priority) can be customized per event by setting an environment variable containing a shell command. The command's stdout (trimmed) is used as the field value. If the command is not set or fails, the hardcoded default is used silently.

Commands are executed via the Bun `$` shell provided by the OpenCode plugin input. Before execution, template variables in the command string are substituted with their values. Unset variables are substituted with empty strings.

#### Environment Variables

| Event | Title | Message | Tags | Priority |
|---|---|---|---|---|
| `session.idle` | `OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD` | `OPENCODE_NTFY_SESSION_IDLE_MESSAGE_CMD` | `OPENCODE_NTFY_SESSION_IDLE_TAGS_CMD` | `OPENCODE_NTFY_SESSION_IDLE_PRIORITY_CMD` |
| `session.error` | `OPENCODE_NTFY_SESSION_ERROR_TITLE_CMD` | `OPENCODE_NTFY_SESSION_ERROR_MESSAGE_CMD` | `OPENCODE_NTFY_SESSION_ERROR_TAGS_CMD` | `OPENCODE_NTFY_SESSION_ERROR_PRIORITY_CMD` |
| `permission.asked` | `OPENCODE_NTFY_PERMISSION_TITLE_CMD` | `OPENCODE_NTFY_PERMISSION_MESSAGE_CMD` | `OPENCODE_NTFY_PERMISSION_TAGS_CMD` | `OPENCODE_NTFY_PERMISSION_PRIORITY_CMD` |

#### Template Variables

| Variable | Available In | Description |
|---|---|---|
| `${event}` | All events | The event type string (e.g., `session.idle`) |
| `${time}` | All events | ISO 8601 timestamp |
| `${error}` | `session.error` only | The error message (empty string for other events) |
| `${permission_type}` | `permission.asked` only | The permission type (empty string for other events) |
| `${permission_patterns}` | `permission.asked` only | Comma-separated list of patterns (empty string for other events) |

#### Default Values

When a custom command environment variable is not set, the following POSIX-compliant commands are used as defaults to populate the notification title and message content. These commands intentionally omit a trailing newline.

##### Title Defaults

| Event | Default Command |
|---|---|
| `session.idle` | `printf "%s" "Agent Idle"` |
| `session.error` | `printf "%s" "Agent Error"` |
| `permission.asked` | `printf "%s" "Permission Asked"` |

##### Message Content Defaults

| Event | Default Command |
|---|---|
| `session.idle` | `printf "%s" "The agent has finished and is waiting for input."` |
| `session.error` | `printf "%s" "An error has occurred. Check the session for details."` |
| `permission.asked` | `printf "%s" "The agent needs permission to continue. Review and respond."` |

##### Tag Defaults

Each event type has a default tag used when no custom tags command is set. These tags correspond to emoji shortcodes supported by ntfy.sh:

| Event | Default Tag | Emoji |
|---|---|---|
| `session.idle` | `hourglass_done` | ⌛ |
| `session.error` | `warning` | ⚠️ |
| `permission.asked` | `lock` | 🔒 |

The README must document these default tags alongside the default title and message values.

#### Execution Details

The module `src/exec.ts` provides a `resolveField` function that:

1. Takes the Bun `$` shell, a command template string (or `undefined`), a variables record, and a fallback default value
2. If the command template is `undefined` or empty, returns the fallback
3. Substitutes all `${var_name}` placeholders in the command with values from the variables record
4. Executes the substituted command via the Bun `$` shell, capturing stdout
5. Returns the trimmed stdout if the command succeeds
6. Returns the fallback value if the command fails (non-zero exit, exception, etc.)

### Notification Icons

All notifications must include an icon displayed alongside the notification on supported ntfy.sh clients. The plugin bundles the official OpenCode branded PNG icons sourced from https://opencode.ai/brand and uses them by default.

**Important:** ntfy.sh only supports JPEG and PNG images for icons (not SVG). All icon assets and default URLs must use PNG format.

#### Bundled Icon Assets

The light and dark variants of the OpenCode icon PNG are stored in the top-level `assets/` directory and checked into version control. This directory is **not** included in the published npm package -- the icons are accessed at runtime via their `raw.githubusercontent.com` URLs, so they do not need to be bundled.

- `assets/opencode-icon-dark.png` -- the dark mode icon (for devices using dark mode), sourced from https://opencode.ai/brand
- `assets/opencode-icon-light.png` -- the light mode icon (for devices using light mode), sourced from https://opencode.ai/brand

#### Default Icon Behavior

Since the ntfy.sh `X-Icon` header requires a publicly accessible URL (not a local file), the default icon URL must point to the raw PNG asset hosted on GitHub via `raw.githubusercontent.com`. The appropriate URL is selected based on the configured mode (light or dark).

Default icon URLs are served from this repo's `assets/` directory via `raw.githubusercontent.com`, using the version tag that corresponds to the current package version. The version is read from `package.json` at runtime and the URL is constructed dynamically using the format `v${version}` (e.g., `v0.1.6`):

- Dark mode (default): `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${version}/assets/opencode-icon-dark.png`
- Light mode: `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${version}/assets/opencode-icon-light.png`

#### Icon Environment Variables

- `OPENCODE_NTFY_ICON_MODE` (optional, defaults to `dark`) -- determines which icon variant to use. Must be explicitly set to `light` or `dark`. If unset or set to any other value, defaults to `dark`. This setting reflects whether the target device receiving push notifications uses light or dark mode.
- `OPENCODE_NTFY_ICON_LIGHT` (optional) -- custom URL to use as the notification icon when `OPENCODE_NTFY_ICON_MODE` is `light`. When set, this overrides the default light mode icon URL. Must point to a JPEG or PNG image.
- `OPENCODE_NTFY_ICON_DARK` (optional) -- custom URL to use as the notification icon when `OPENCODE_NTFY_ICON_MODE` is `dark`. When set, this overrides the default dark mode icon URL. Must point to a JPEG or PNG image.

The icon resolution logic is:

1. Determine the mode from `OPENCODE_NTFY_ICON_MODE` (default: `dark`).
2. If the mode is `light` and `OPENCODE_NTFY_ICON_LIGHT` is set, use that URL.
3. If the mode is `dark` and `OPENCODE_NTFY_ICON_DARK` is set, use that URL.
4. Otherwise, use the default `raw.githubusercontent.com` PNG URL for the corresponding mode.

### Notification Cooldown

The plugin supports configurable rate limiting to prevent notification spam when the agent rapidly cycles through states.

- `OPENCODE_NTFY_COOLDOWN` accepts an ISO 8601 duration string (e.g., `PT30S` for 30 seconds, `PT5M` for 5 minutes). The duration is parsed by `src/cooldown.ts` via `parseISO8601Duration()`, which supports hours (`H`), minutes (`M`), seconds (`S`), and fractional seconds.
- `OPENCODE_NTFY_COOLDOWN_EDGE` controls the throttling strategy:
  - `leading` (default): The first notification fires immediately. Subsequent notifications for the same event type are suppressed until the cooldown period elapses.
  - `trailing`: Notifications are suppressed until the cooldown period elapses since the last event of that type. Each new event resets the cooldown timer.
- Cooldown is tracked per event type (e.g., `session.idle` and `session.error` have independent cooldown timers).
- When `OPENCODE_NTFY_COOLDOWN` is not set, no rate limiting is applied.
- A cooldown of `PT0S` (zero seconds) disables rate limiting.

The cooldown guard is implemented in `src/cooldown.ts` and exposes:

- `parseISO8601Duration(duration: string): number` -- parses an ISO 8601 duration string and returns milliseconds
- `createCooldownGuard(options: CooldownOptions): CooldownGuard` -- creates a stateful guard that tracks per-event-type cooldowns
- `CooldownGuard.shouldAllow(eventType: string): boolean` -- returns whether a notification should be sent

### Publishing via ntfy.sh

Notifications are sent via HTTP POST:

```
POST https://ntfy.sh/<topic>
Headers:
  Title: <title>
  Priority: <priority>
  Tags: <tags>
  X-Icon: <resolved icon URL based on mode and environment variables>
  Authorization: Bearer <token>  (if token is set)
Body: <message>
```

The `NotificationPayload` type must include an optional `priority` field. When set, it overrides the global `config.priority` for that specific notification. This allows per-event priority commands to take effect.

When `config.fetchTimeout` is set (parsed from `OPENCODE_NTFY_FETCH_TIMEOUT`), the `fetch` call must include a `signal` option set to `AbortSignal.timeout(config.fetchTimeout)` where `config.fetchTimeout` is the timeout in milliseconds. This ensures the HTTP request is aborted if the ntfy.sh server does not respond within the configured duration.

### Node.js Version Support

The plugin must support all currently supported versions of Node.js (i.e., versions that have not reached end-of-life). As of the time of writing, the supported versions are Node.js 20, 22, and 24. This support must be enforced in two ways:

1. **`engines` field in `package.json`**: Set the `engines.node` field to restrict the minimum supported Node.js version. Since the plugin relies on native `fetch` (available since Node.js 18) and uses ES module syntax, the minimum version must match the oldest currently supported Node.js release (e.g., `>=20`). Update this field as Node.js versions reach end-of-life.
2. **CI matrix in `.github/workflows/ci.yml`**: The CI pipeline must use a matrix strategy to run lint, build, and test steps against all currently supported Node.js versions. This ensures compatibility is verified on every pull request and push. The publish step must only run once (on the latest Node.js version) to avoid duplicate publishes.

### Tech Stack

- TypeScript
- ESLint with typescript-eslint for linting
- Vitest for testing
- No runtime dependencies beyond Node.js built-in `fetch`
- Publishable as an npm package

### Project Structure

```
opencode-ntfy.sh/
  assets/
    opencode-icon-light.png  # OpenCode icon for light mode (not published to npm)
    opencode-icon-dark.png   # OpenCode icon for dark mode (not published to npm)
  src/
    index.ts          # Plugin entry point and export
    notify.ts         # ntfy.sh HTTP client
    config.ts         # Configuration from environment variables
    exec.ts           # Command execution and template variable substitution
    cooldown.ts       # ISO 8601 duration parsing and cooldown guard
  tests/
    notify.test.ts    # Tests for the notification client
    config.test.ts    # Tests for configuration loading
    plugin.test.ts    # Tests for the plugin hooks
    exec.test.ts      # Tests for command execution
    cooldown.test.ts  # Tests for cooldown guard and duration parsing
    typecheck.test.ts # Compile-time type conformance tests
    mock-shell.ts     # Shared mock BunShell factory
    msw-helpers.ts    # MSW test helpers for capturing HTTP requests
  eslint.config.js      # ESLint configuration
  package.json
  tsconfig.json
  vitest.config.ts
  PROMPT.md           # This file
  PLAN.md             # Implementation plan / task tracker
  ralph.sh            # The loop script
```
