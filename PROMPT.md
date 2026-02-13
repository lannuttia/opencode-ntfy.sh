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
| `${project}` | All events | Project name derived from the working directory |
| `${event}` | All events | The event type string (e.g., `session.idle`) |
| `${time}` | All events | ISO 8601 timestamp |
| `${error}` | `session.error` only | The error message (empty string for other events) |
| `${permission-type}` | `permission.asked` only | The permission type (empty string for other events) |
| `${permission-patterns}` | `permission.asked` only | Comma-separated list of patterns (empty string for other events) |

#### Execution Details

- A new module `src/exec.ts` provides a `resolveField` function that:
  1. Takes the Bun `$` shell, a command template string (or `undefined`), a variables record, and a fallback default value
  2. If the command template is `undefined` or empty, returns the fallback
   3. Substitutes all `${var-name}` placeholders in the command with values from the variables record
  4. Executes the substituted command via the Bun `$` shell, capturing stdout
  5. Returns the trimmed stdout if the command succeeds
  6. Returns the fallback value if the command fails (non-zero exit, exception, etc.)

### Publishing via ntfy.sh

Send notifications via HTTP POST:

```
POST https://ntfy.sh/<topic>
Headers:
  Title: <title>
  Priority: <priority>
  Tags: <tags>
  Authorization: Bearer <token>  (if token is set)
Body: <message>
```

The `NotificationPayload` type should include an optional `priority` field. When set, it overrides the global `config.priority` for that specific notification. This allows per-event priority commands to take effect.

### Project Structure

```
opencode-ntfy.sh/
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
  package.json
  tsconfig.json
  vitest.config.ts
  PROMPT.md           # This file
  PLAN.md             # Implementation plan / task tracker
  ralph.sh            # The loop script
```

### Tech Stack

- TypeScript
- Vitest for testing
- No runtime dependencies beyond Node.js built-in `fetch`
- Publishable as an npm package
