# opencode-ntfy.sh

An [OpenCode](https://opencode.ai) plugin that sends push notifications via
[ntfy.sh](https://ntfy.sh) when your AI coding session finishes or encounters
an error. Start a long-running task, walk away, and get notified on your phone
or desktop when it needs your attention.

## Notifications

The plugin sends notifications for two events:

- **Session Idle** -- The AI agent has finished its work and is waiting for
  input. Includes the project name and timestamp.
- **Session Error** -- The session encountered an error. Includes the project
  name, timestamp, and error message (when available).

If `NTFY_TOPIC` is not set, the plugin does nothing.

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
| `NTFY_TOPIC` | Yes | -- | The ntfy.sh topic to publish to. |
| `NTFY_SERVER` | No | `https://ntfy.sh` | The ntfy server URL. Set this to use a self-hosted instance. |
| `NTFY_TOKEN` | No | -- | Bearer token for authenticated topics. |
| `NTFY_PRIORITY` | No | `default` | Notification priority. One of: `min`, `low`, `default`, `high`, `max`. |

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
export NTFY_TOPIC="my-opencode-notifications"
opencode
```

With authentication and a self-hosted server:

```sh
export NTFY_TOPIC="my-opencode-notifications"
export NTFY_SERVER="https://ntfy.example.com"
export NTFY_TOKEN="tk_mytoken"
export NTFY_PRIORITY="high"
opencode
```

## Development

### Prerequisites

- Node.js (v18+ for native `fetch` support)
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
