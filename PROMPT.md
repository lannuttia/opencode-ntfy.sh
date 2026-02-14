# opencode-ntfy.sh

You are building an OpenCode plugin that sends push notifications via ntfy.sh.

## Goal

Build a TypeScript OpenCode plugin (`opencode-ntfy.sh`) that sends push notifications to a user's phone/desktop via the ntfy.sh service when key events occur during an OpenCode session.

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

- The plugin should be an OpenCode plugin that can be installed via npm or placed in `.opencode/plugins/`.
- It should send ntfy.sh notifications on the following events via the `event` hook:
  - `session.idle` - when the agent finishes and is waiting for input
  - `session.error` - when a session encounters an error
  - `permission.asked` - when the agent needs permission to perform an action
- Default notifications should include:
  - The event type
  - The project name (derived from the working directory)
  - A timestamp
  - For errors: the error message
  - For permissions: the permission type and patterns
- The plugin should be configurable via environment variables:
  - `OPENCODE_NTFY_TOPIC` (required) - the ntfy.sh topic to publish to
  - `OPENCODE_NTFY_SERVER` (optional, defaults to `https://ntfy.sh`) - the ntfy.sh server URL
  - `OPENCODE_NTFY_TOKEN` (optional) - bearer token for authentication
  - `OPENCODE_NTFY_PRIORITY` (optional, defaults to `default`) - global notification priority (min, low, default, high, max)
  - `OPENCODE_NTFY_ICON_MODE` (optional, defaults to `dark`) - whether the target device uses `light` or `dark` mode
  - `OPENCODE_NTFY_ICON_LIGHT` (optional) - custom icon URL override for light mode
  - `OPENCODE_NTFY_ICON_DARK` (optional) - custom icon URL override for dark mode

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

#### Default Commands

When a custom command environment variable is not set, the following POSIX-compliant commands are used as defaults to populate the notification title and message content. These commands intentionally omit a trailing newline.

##### Title Defaults

| Event | Default Command |
|---|---|
| `session.error` | `printf "%s" "Agent Error"` |
| `session.idle` | `printf "%s" "Agent Idle"` |
| `permission.asked` | `printf "%s" "Permission Asked"` |

##### Message Content Defaults

| Event | Default Command |
|---|---|
| `session.error` | `printf "%s" "An error has occurred. Check the session for details."` |
| `session.idle` | `printf "%s" "The agent has finished and is waiting for input."` |
| `permission.asked` | `printf "%s" "The agent needs permission to continue. Review and respond."` |

#### Execution Details

- A new module `src/exec.ts` provides a `resolveField` function that:
  1. Takes the Bun `$` shell, a command template string (or `undefined`), a variables record, and a fallback default value
  2. If the command template is `undefined` or empty, returns the fallback
   3. Substitutes all `${var_name}` placeholders in the command with values from the variables record
  4. Executes the substituted command via the Bun `$` shell, capturing stdout
  5. Returns the trimmed stdout if the command succeeds
  6. Returns the fallback value if the command fails (non-zero exit, exception, etc.)

### Notification Icons

All notifications should include an icon displayed alongside the notification on supported ntfy.sh clients. The plugin bundles the official OpenCode branded PNG icons sourced from https://opencode.ai/brand and uses them by default.

**Important:** ntfy.sh only supports JPEG and PNG images for icons (not SVG). All icon assets and default URLs must use PNG format.

#### Bundled Icon Assets

The light and dark variants of the OpenCode icon PNG are stored in the top-level `assets/` directory and checked into version control. This directory is **not** included in the published npm package -- the icons are accessed at runtime via their `raw.githubusercontent.com` URLs, so they do not need to be bundled.

- `assets/opencode-icon-dark.png` - the dark mode icon (for devices using dark mode), sourced from https://opencode.ai/brand
- `assets/opencode-icon-light.png` - the light mode icon (for devices using light mode), sourced from https://opencode.ai/brand

#### Default Icon Behavior

Since the ntfy.sh `X-Icon` header requires a publicly accessible URL (not a local file), the default icon URL should point to the raw PNG asset hosted on GitHub via `raw.githubusercontent.com`. The appropriate URL is selected based on the configured mode (light or dark).

Default icon URLs are served from this repo's `assets/` directory via `raw.githubusercontent.com`, using the version tag that corresponds to the current package version. The version is read from `package.json` at runtime and the URL is constructed dynamically using the format `v${version}` (e.g., `v0.1.6`):

- Dark mode (default): `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${version}/assets/opencode-icon-dark.png`
- Light mode: `https://raw.githubusercontent.com/lannuttia/opencode-ntfy.sh/v${version}/assets/opencode-icon-light.png`

#### Icon Environment Variables

- `OPENCODE_NTFY_ICON_MODE` (optional, defaults to `dark`) - determines which icon variant to use. Must be explicitly set to `light` or `dark`. If unset or set to any other value, defaults to `dark`. This setting reflects whether the target device receiving push notifications uses light or dark mode.
- `OPENCODE_NTFY_ICON_LIGHT` (optional) - a custom URL to use as the notification icon when `OPENCODE_NTFY_ICON_MODE` is `light`. When set, this overrides the default light mode icon URL. Must point to a JPEG or PNG image.
- `OPENCODE_NTFY_ICON_DARK` (optional) - a custom URL to use as the notification icon when `OPENCODE_NTFY_ICON_MODE` is `dark`. When set, this overrides the default dark mode icon URL. Must point to a JPEG or PNG image.

The icon resolution logic is:
1. Determine the mode from `OPENCODE_NTFY_ICON_MODE` (default: `dark`).
2. If the mode is `light` and `OPENCODE_NTFY_ICON_LIGHT` is set, use that URL.
3. If the mode is `dark` and `OPENCODE_NTFY_ICON_DARK` is set, use that URL.
4. Otherwise, use the default `raw.githubusercontent.com` PNG URL for the corresponding mode.

### Publishing via ntfy.sh

Send notifications via HTTP POST:

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

The `NotificationPayload` type should include an optional `priority` field. When set, it overrides the global `config.priority` for that specific notification. This allows per-event priority commands to take effect.

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
  tests/
    notify.test.ts    # Tests for the notification client
    config.test.ts    # Tests for configuration loading
    plugin.test.ts    # Tests for the plugin hooks
    exec.test.ts      # Tests for command execution
  eslint.config.js      # ESLint configuration
  package.json
  tsconfig.json
  vitest.config.ts
  PROMPT.md           # This file
  PLAN.md             # Implementation plan / task tracker
  ralph.sh            # The loop script
```

### Tech Stack

- TypeScript
- ESLint with typescript-eslint for linting
- Vitest for testing
- No runtime dependencies beyond Node.js built-in `fetch`
- Publishable as an npm package
