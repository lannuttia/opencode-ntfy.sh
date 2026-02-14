# opencode-ntfy.sh

[![CI](https://github.com/lannuttia/opencode-ntfy.sh/actions/workflows/ci.yml/badge.svg)](https://github.com/lannuttia/opencode-ntfy.sh/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/lannuttia/opencode-ntfy.sh/graph/badge.svg)](https://codecov.io/gh/lannuttia/opencode-ntfy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/lannuttia/opencode-ntfy.sh/blob/main/LICENSE)
[![Snyk Advisor](https://snyk.io/advisor/npm-package/opencode-ntfy.sh/badge.svg)](https://snyk.io/advisor/npm-package/opencode-ntfy.sh)

An [OpenCode](https://opencode.ai) plugin that sends push notifications via
[ntfy.sh](https://ntfy.sh) when your AI coding session finishes or encounters
an error. Start a long-running task, walk away, and get notified on your phone
or desktop when it needs your attention.

## Notifications

The plugin sends notifications for three events:

- **Session Idle** -- The AI agent has finished its work and is waiting for
  input. Includes the project name and timestamp.
- **Session Error** -- The session encountered an error. Includes the project
  name, timestamp, and error message (when available).
- **Permission Asked** -- The agent needs permission to perform an action.
  Includes the project name, timestamp, permission type, and patterns.

If `OPENCODE_NTFY_TOPIC` is not set, the plugin does nothing.

## Install

Add the package name to the `plugin` array in your OpenCode config file.

opencode.json:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-ntfy.sh"]
}
```

## Configuration

Configuration is done through environment variables.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENCODE_NTFY_TOPIC` | Yes | -- | The ntfy.sh topic to publish to. |
| `OPENCODE_NTFY_SERVER` | No | `https://ntfy.sh` | The ntfy server URL. Set this to use a self-hosted instance. |
| `OPENCODE_NTFY_TOKEN` | No | -- | Bearer token for authenticated topics. |
| `OPENCODE_NTFY_PRIORITY` | No | `default` | Global notification priority. One of: `min`, `low`, `default`, `high`, `max`. |
| `OPENCODE_NTFY_ICON_MODE` | No | `dark` | Icon variant to use: `light` or `dark`. Reflects whether the target device uses light or dark mode. |
| `OPENCODE_NTFY_ICON_LIGHT` | No | -- | Custom icon URL override for light mode. Must be JPEG or PNG. |
| `OPENCODE_NTFY_ICON_DARK` | No | -- | Custom icon URL override for dark mode. Must be JPEG or PNG. |
| `OPENCODE_NTFY_COOLDOWN` | No | -- | ISO 8601 duration for notification cooldown (e.g., `PT30S`, `PT5M`). Suppresses duplicate notifications per event type within the cooldown period. |
| `OPENCODE_NTFY_COOLDOWN_EDGE` | No | `leading` | Cooldown edge: `leading` sends immediately then suppresses, `trailing` waits for a quiet period before sending. |
| `OPENCODE_NTFY_FETCH_TIMEOUT` | No | -- | ISO 8601 duration for the HTTP request timeout (e.g., `PT10S`, `PT1M`). When set, the fetch call is aborted if the server does not respond in time. |

### Custom Notification Commands

Each notification field (title, message, tags, priority) can be customized
per event by setting an environment variable containing a shell command. The
command's stdout (trimmed) is used as the field value. If the command is not
set or fails, the hardcoded default is used silently.

Before execution, template variables in the command string are substituted
with their values. Unset variables are substituted with empty strings.

#### Per-Event Environment Variables

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

When a custom command environment variable is not set, the following
POSIX-compliant defaults are used. These commands do not include a trailing
newline.

**Title defaults:**

| Event | Default Command |
|---|---|
| `session.idle` | `printf "%s" "Agent Idle"` |
| `session.error` | `printf "%s" "Agent Error"` |
| `permission.asked` | `printf "%s" "Permission Asked"` |

**Message content defaults:**

| Event | Default Command |
|---|---|
| `session.idle` | `printf "%s" "The agent has finished and is waiting for input."` |
| `session.error` | `printf "%s" "An error has occurred. Check the session for details."` |
| `permission.asked` | `printf "%s" "The agent needs permission to continue. Review and respond."` |

**Tag defaults:**

Each event type has a default tag corresponding to an
[emoji shortcode](https://docs.ntfy.sh/emojis/) supported by ntfy.sh:

| Event | Default Tag | Emoji |
|---|---|---|
| `session.idle` | `hourglass_done` | ⌛ |
| `session.error` | `warning` | ⚠️ |
| `permission.asked` | `lock` | 🔒 |

#### Example

```sh
# Custom title for idle notifications
export OPENCODE_NTFY_SESSION_IDLE_TITLE_CMD='echo "${event} is done"'

# Custom message with timestamp
export OPENCODE_NTFY_SESSION_ERROR_MESSAGE_CMD='echo "Error at ${time}: ${error}"'

# Override priority for permission requests
export OPENCODE_NTFY_PERMISSION_PRIORITY_CMD='echo "high"'
```

### Subscribing to notifications

To receive notifications, subscribe to your topic using any
[ntfy client](https://docs.ntfy.sh/subscribe/):

- **Phone**: Install the ntfy app
  ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy),
  [iOS](https://apps.apple.com/us/app/ntfy/id1625396347)) and subscribe to
  your topic.
- **Desktop**: Open `https://ntfy.sh/<your-topic>` in a browser.
- **CLI**: `curl -s ntfy.sh/<your-topic>/json`

### Example

```sh
export OPENCODE_NTFY_TOPIC="my-opencode-notifications"
opencode
```

With authentication and a self-hosted server:

```sh
export OPENCODE_NTFY_TOPIC="my-opencode-notifications"
export OPENCODE_NTFY_SERVER="https://ntfy.example.com"
export OPENCODE_NTFY_TOKEN="tk_mytoken"
export OPENCODE_NTFY_PRIORITY="high"
opencode
```

With rate limiting (suppress duplicate notifications within 30 seconds):

```sh
export OPENCODE_NTFY_TOPIC="my-opencode-notifications"
export OPENCODE_NTFY_COOLDOWN="PT30S"
opencode
```

## Development

### Prerequisites

- Node.js (v20+)
- npm

### Setup

```sh
git clone https://github.com/lannuttia/opencode-ntfy.sh.git
cd opencode-ntfy.sh
npm install
```

### Build

```sh
npm run build
```

This compiles TypeScript from `src/` to `dist/` via `tsc`.

### Test

```sh
npm test
```

Or in watch mode:

```sh
npm run test:watch
```

### Using a development build with OpenCode

To use a local development build as a plugin, place or symlink the project
directory into the OpenCode plugins folder:

```sh
# Build first
npm run build

# Project-level (applies to a single project)
ln -s /path/to/opencode-ntfy.sh .opencode/plugins/opencode-ntfy.sh

# Or global (applies to all projects)
ln -s /path/to/opencode-ntfy.sh ~/.config/opencode/plugins/opencode-ntfy.sh
```

Then set the required environment variables and start OpenCode as usual.

## License

MIT
