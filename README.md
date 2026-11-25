# opencode-ntfy.sh

[![CI](https://github.com/lannuttia/opencode-ntfy.sh/actions/workflows/ci.yml/badge.svg)](https://github.com/lannuttia/opencode-ntfy.sh/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/lannuttia/opencode-ntfy.sh/graph/badge.svg)](https://codecov.io/gh/lannuttia/opencode-ntfy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/lannuttia/opencode-ntfy.sh/blob/main/LICENSE)
[![Snyk Vulnerabilities](https://snyk.io/test/github/lannuttia/opencode-ntfy.sh/badge.svg)](https://security.snyk.io/package/npm/opencode-ntfy.sh)

An [OpenCode](https://opencode.ai) notification backend plugin for
[ntfy.sh](https://ntfy.sh). Built on the
[`opencode-notification-sdk`](https://www.npmjs.com/package/opencode-notification-sdk),
this plugin delivers push notifications to your phone or desktop when your AI
coding session finishes, encounters an error, or needs permission. Start a
long-running task, walk away, and get notified when it needs your attention.

## How It Works

This plugin is a **notification backend** for the `opencode-notification-sdk`.
The SDK loads and validates the config file (`enabled` and `events`) and provides
the template helpers. The plugin itself owns the rest:

- **Event routing** -- classifying OpenCode V2 events into notification types
- **Subagent suppression** -- silently suppressing notifications from sub-agent
  (child) sessions for idle and error events
- **Deduplication** -- sending at most one push per OpenCode event id
- **ntfy delivery** -- producing notification content (title and message),
  formatting and sending the HTTP POST request, adding OpenCode tap-action deep
  links, validating ntfy-specific configuration, and resolving the notification
  icon URL

## Notifications

The plugin sends notifications for three events:

- **Session Idle** -- The AI agent has finished its work and is waiting for
  input.
- **Session Error** -- The session encountered an error.
- **Permission Asked** -- The agent needs permission to perform an action.

On OpenCode V2, completion is observed from `session.execution.succeeded`. The
older `session.status` event with `status.type === "idle"` is still handled for
compatibility with earlier V2 releases. Errors come from
`session.execution.failed`, and prompts from `permission.asked`.

### Deduplication

Global plugin config is loaded once per OpenCode location, and each instance
receives the same server events. To avoid four identical pushes for one
completion, the plugin claims each OpenCode event id in a shared temp directory
(`$TMPDIR/opencode-ntfy-dedupe`, or `/tmp/opencode-ntfy-dedupe`). Claims expire
after one hour, stale files are pruned on load, and any filesystem error fails
open so a notification is never silently lost.

### Default Tags

Each event type has a default tag corresponding to an
[emoji shortcode](https://docs.ntfy.sh/emojis/) supported by ntfy.sh:

| Event | Default Tag | Emoji |
|---|---|---|
| `session.idle` | `hourglass_done` | ⌛ |
| `session.error` | `warning` | ⚠️ |
| `permission.asked` | `lock` | 🔒 |

### Notification Tap Actions

Each notification includes an ntfy `Click` URL. By default, tapping it opens
`opencode://session/<sessionID>`. OpenCode Desktop builds with session deep-link
support open that exact session; older builds may only launch or focus OpenCode.
If an event has no session ID, the link falls back to `opencode://`.

Set `backend.click` to use a different URL. It supports the same template
variables as titles and messages, and an empty string disables the tap action:

```json
{
  "backend": {
    "topic": "my-opencode-notifications",
    "click": "opencode://session/{session_id}"
  }
}
```

## Install

Add the package name to the `plugins` array in your OpenCode config file.

opencode.json:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-ntfy.sh"]
}
```

## Configuration

Configuration is done through a JSON file at
`~/.config/opencode/notification-ntfy.json`.

You can reference the bundled JSON Schema for editor autocompletion and
validation by adding a `$schema` property:

```json
{
  "$schema": "node_modules/opencode-ntfy.sh/notification-ntfy.schema.json",
  "backend": {
    "topic": "my-notifications"
  }
}
```

### Full Configuration Structure

The config file follows the SDK's configuration schema at the top level, with
ntfy-specific settings under the `backend` key.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `enabled` | `boolean` | No | `true` | Global kill switch for all notifications (handled by SDK). |
| `events` | `object` | No | (all enabled) | Per-event enable/disable toggles (handled by SDK). |
| `events.<type>.enabled` | `boolean` | No | `true` | Whether this event type triggers notifications (handled by SDK). |
| `backend` | `object` | No | `{}` | ntfy.sh-specific configuration (see below). |

### Backend Configuration Properties

The `backend` object contains all ntfy.sh-specific settings:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `backend.topic` | `string` | **Yes** | -- | The ntfy.sh topic to publish to. |
| `backend.server` | `string` | No | `https://ntfy.sh` | The ntfy server URL. |
| `backend.token` | `string` | No | -- | Bearer token for authentication. |
| `backend.priority` | `string` | No | `default` | Notification priority (`min`, `low`, `default`, `high`, `max`). |
| `backend.icon` | `object` | No | -- | Icon configuration object. |
| `backend.icon.mode` | `string` | No | `dark` | Whether the target device uses `light` or `dark` mode. |
| `backend.icon.variant` | `object` | No | -- | Custom icon URL overrides per mode variant. |
| `backend.icon.variant.light` | `string` | No | -- | Custom icon URL override for light mode. |
| `backend.icon.variant.dark` | `string` | No | -- | Custom icon URL override for dark mode. |
| `backend.fetchTimeout` | `string` | No | -- | ISO 8601 duration for the HTTP request timeout (e.g., `PT10S`). |
| `backend.click` | `string` | No | `opencode://session/{session_id}` | URL opened when the notification is tapped. Supports template variables; an empty string disables the tap action. |
| `backend.title` | `object` | No | (see defaults) | Title configuration per event type. |
| `backend.title.<event>` | `object` | No | (see defaults) | Content template for the notification title. Must contain exactly one of `value` or `command`. |
| `backend.title.<event>.value` | `string` | No | -- | A template string rendered with `{var_name}` substitution. |
| `backend.title.<event>.command` | `string` | No | -- | A template string rendered and executed as a shell command; stdout is used as the title. |
| `backend.message` | `object` | No | (see defaults) | Message configuration per event type. |
| `backend.message.<event>` | `object` | No | (see defaults) | Content template for the notification message. Must contain exactly one of `value` or `command`. |
| `backend.message.<event>.value` | `string` | No | -- | A template string rendered with `{var_name}` substitution. |
| `backend.message.<event>.command` | `string` | No | -- | A template string rendered and executed as a shell command; stdout is used as the message. |

### Variable Substitution

All string values in the config file support two placeholder syntaxes, expanded
by the SDK before validation:

- **`{env:VAR_NAME}`** -- replaced with the value of the corresponding
  environment variable. If the variable is not set, the placeholder is replaced
  with an empty string.
- **`{file:path/to/file}`** -- replaced with the trimmed contents of the
  specified file. Paths can be absolute (`/`), home-relative (`~`), or relative
  to the config file's directory. If the file does not exist or cannot be read,
  the placeholder is replaced with an empty string.

This allows sensitive values like topics and tokens to be externalized, making
the config safe to commit to version control:

```json
{
  "backend": {
    "topic": "{env:NTFY_TOPIC}",
    "token": "{file:~/.secrets/ntfy-token}"
  }
}
```

### Notification Content

The notification title and message are configurable per event type via
`backend.title` and `backend.message`. Each key is an event type
(`session.idle`, `session.error`, `permission.asked`), and the value specifies
how to produce the content:

- **`value`** -- A template string with `{var_name}` placeholders, resolved via
  the SDK's `renderTemplate`. No shell execution.
- **`command`** -- A template string with `{var_name}` placeholders, resolved
  and then executed as a shell command. The trimmed stdout is used as the
  content.

Each per-event object must contain exactly one of `value` or `command`.

#### Available Template Variables

| Variable | Description |
|---|---|
| `{event}` | Event type (e.g., `session.idle`) |
| `{time}` | ISO 8601 timestamp |
| `{project}` | Project directory basename |
| `{session_id}` | Session ID (empty if unavailable) |
| `{error}` | Error message (empty if not an error event) |
| `{permission_type}` | Permission type (empty if not a permission event) |
| `{permission_patterns}` | Comma-separated patterns (empty if not a permission event) |

#### Default Values

When no title or message template is configured for an event type, these
defaults are used:

| Event | Default Title | Default Message |
|---|---|---|
| `session.idle` | `Agent Idle` | `The agent has finished and is waiting for input.` |
| `session.error` | `Agent Error` | `An error has occurred. Check the session for details.` |
| `permission.asked` | `Permission Asked` | `The agent needs permission to continue. Review and respond.` |

### Example Configurations

Minimal configuration (`~/.config/opencode/notification-ntfy.json`):

```json
{
  "backend": {
    "topic": "my-opencode-notifications"
  }
}
```

With authentication and a self-hosted server:

```json
{
  "backend": {
    "topic": "my-opencode-notifications",
    "server": "https://ntfy.example.com",
    "token": "tk_mytoken",
    "priority": "high"
  }
}
```

Full configuration:

```json
{
  "enabled": true,
  "events": {
    "session.idle": { "enabled": true },
    "session.error": { "enabled": true },
    "permission.asked": { "enabled": true }
  },
  "backend": {
    "topic": "{env:NTFY_TOPIC}",
    "server": "https://ntfy.sh",
    "priority": "default",
    "token": "{file:~/.secrets/ntfy-token}",
    "title": {
      "session.idle": { "value": "{project}: Agent Idle" },
      "session.error": { "value": "{project}: Agent Error" }
    },
    "message": {
      "session.error": { "value": "Error in {project}: {error}" }
    },
    "icon": {
      "mode": "dark"
    },
    "fetchTimeout": "PT10S"
  }
}
```

With command templates:

```json
{
  "backend": {
    "topic": "my-notifications",
    "title": {
      "session.idle": { "command": "echo Agent finished in {project}" }
    },
    "message": {
      "permission.asked": { "command": "echo Permission {permission_type} requested" }
    }
  }
}
```

### Subscribing to Notifications

To receive notifications, subscribe to your topic using any
[ntfy client](https://docs.ntfy.sh/subscribe/):

- **Phone**: Install the ntfy app
  ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy),
  [iOS](https://apps.apple.com/us/app/ntfy/id1625396347)) and subscribe to
  your topic.
- **Desktop**: Open `https://ntfy.sh/<your-topic>` in a browser.
- **CLI**: `curl -s ntfy.sh/<your-topic>/json`

## Development

### Prerequisites

- [Bun](https://bun.sh)

### Setup

```sh
git clone https://github.com/lannuttia/opencode-ntfy.sh.git
cd opencode-ntfy.sh
bun install
```

### Build

```sh
bun run build
```

This compiles TypeScript from `src/` to `dist/` via `tsc`.

### Test

```sh
bun run test
```

Or in watch mode:

```sh
bun run test:watch
```

## License

MIT
