# opencode-ntfy.sh

You are building an OpenCode plugin that sends push notifications via ntfy.sh.

## Goal

Build a TypeScript OpenCode plugin (`opencode-ntfy.sh`) that sends push notifications to a user's phone/desktop via the ntfy.sh service when key events occur during an OpenCode session.

## Instructions

1. Read the PLAN.md to understand the current state of implementation.
2. Pick the SINGLE highest priority incomplete item from PLAN.md and implement it.
3. Ensure tests pass after your changes.
4. Update PLAN.md with your progress and commit all changes with `git add -A && git commit -m "..."`.

If there is a discrepancy between PLAN.md and this prompt, always update PLAN.md to match this prompt.

## Specifications

### Plugin Behavior

- The plugin should be an OpenCode plugin that can be installed via npm or placed in `.opencode/plugins/`.
- It should send ntfy.sh notifications on the following events:
  - `session.idle` - when the agent finishes and is waiting for input
  - `session.error` - when a session encounters an error
  - `permission.asked` - when the agent needs permission to perform an action
- Notifications should include:
  - The event type
  - The project name (derived from the working directory)
  - A timestamp
  - For errors: the error message
- The plugin should be configurable via environment variables:
  - `NTFY_TOPIC` (required) - the ntfy.sh topic to publish to
  - `NTFY_SERVER` (optional, defaults to `https://ntfy.sh`) - the ntfy.sh server URL
  - `NTFY_TOKEN` (optional) - bearer token for authentication
  - `NTFY_PRIORITY` (optional, defaults to `default`) - notification priority (min, low, default, high, max)

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

### Project Structure

```
opencode-ntfy.sh/
  src/
    index.ts          # Plugin entry point and export
    notify.ts         # ntfy.sh HTTP client
    config.ts         # Configuration from environment variables
  tests/
    notify.test.ts    # Tests for the notification client
    config.test.ts    # Tests for configuration loading
    plugin.test.ts    # Tests for the plugin hooks
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

### CI
This project will use GitHub Actions and needs to perform the following:
- Run the tests
- If the pipeline run was triggered by the pushing of a version tag, then the following should happen:
  - As part of the prepublish npm hook, the package should be built.
  - The package should be published to https://registry.npmjs.org/

Publishing must use npm trusted publishing (OIDC) as documented at https://docs.npmjs.com/trusted-publishers. The GitHub Actions workflow must satisfy the following requirements:
- The publish job must run on a GitHub-hosted runner (self-hosted runners are not supported)
- The publish job must have `permissions: id-token: write` and `contents: read`
- The publish job must use Node.js >= 22.14.0 (npm CLI >= 11.5.1 is required for OIDC trusted publishing)
- The `actions/setup-node` step must set `registry-url` to `https://registry.npmjs.org`
- The publish job must NOT use `NODE_AUTH_TOKEN` or `secrets.NPM_TOKEN`; npm CLI auto-detects the OIDC environment and authenticates without a token
- The `--provenance` flag is not required; provenance attestations are generated automatically with trusted publishing
- `package.json` must include a `repository` field matching the GitHub repository (required for provenance)
