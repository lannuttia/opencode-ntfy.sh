import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("type conformance", () => {
  it("should type-check that the plugin export satisfies the @opencode-ai/plugin Plugin type", () => {
    const checkFile = join(ROOT, "src", "_typecheck_plugin.ts");

    writeFileSync(
      checkFile,
      `
import type { Plugin } from "@opencode-ai/plugin";
import { plugin } from "./index.js";

// This assignment will fail at compile time if plugin does not match the Plugin type.
const _check: Plugin = plugin;
void _check;
`
    );

    try {
      execSync("npx tsc --noEmit", {
        cwd: ROOT,
        encoding: "utf-8",
      });
    } finally {
      unlinkSync(checkFile);
    }
  });

  it("should type-check that sendNotification does not accept a fetchFn parameter", () => {
    const checkFile = join(ROOT, "src", "_typecheck_notify.ts");

    writeFileSync(
      checkFile,
      `
import { sendNotification } from "./notify.js";
import type { NtfyConfig } from "./config.js";

const config: NtfyConfig = { topic: "t", server: "s", priority: "default" };
const payload = { title: "t", message: "m", tags: "tag" };

// sendNotification should only accept 2 arguments (config, payload).
// If it accepts a 3rd argument, this type check should fail.
type Params = Parameters<typeof sendNotification>;
type AssertExactlyTwo = Params extends [unknown, unknown] ? true : false;
const _check: AssertExactlyTwo = true;
void _check;
`
    );

    try {
      execSync("npx tsc --noEmit", {
        cwd: ROOT,
        encoding: "utf-8",
      });
    } finally {
      unlinkSync(checkFile);
    }
  });
});
