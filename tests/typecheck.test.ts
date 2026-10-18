import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("type conformance", () => {
  it("should type-check that the default export satisfies the @opencode/plugin Plugin type", { timeout: 30000 }, () => {
    const checkFile = join(ROOT, "src", "_typecheck_plugin.ts");

    writeFileSync(
      checkFile,
      `
import { Plugin } from "@opencode/plugin";
import plugin from "./index.js";

// This assignment will fail at compile time if plugin does not match the Plugin type.
const _check: Plugin.Plugin = plugin;
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

  it("should not compile _typecheck_* files into dist when they exist in src", { timeout: 30000 }, () => {
    const checkFile = join(ROOT, "src", "_typecheck_build_test.ts");

    writeFileSync(
      checkFile,
      `// Temporary file to verify build exclusion\nexport const _unused = true;\n`
    );

    try {
      // Run a full build (with emit) to check dist output
      execSync("npx tsc", {
        cwd: ROOT,
        encoding: "utf-8",
      });

      const distFiles = readdirSync(join(ROOT, "dist"));
      const typecheckArtifacts = distFiles.filter((f) =>
        f.startsWith("_typecheck_")
      );

      expect(typecheckArtifacts).toEqual([]);
    } finally {
      unlinkSync(checkFile);
    }
  });

  it("should type-check that createNtfyBackend returns NotificationBackend", { timeout: 30000 }, () => {
    const checkFile = join(ROOT, "src", "_typecheck_backend.ts");

    writeFileSync(
      checkFile,
      `
import type { NotificationBackend } from "opencode-notification-sdk";
import { createNtfyBackend } from "./backend.js";
import type { NtfyBackendConfig } from "./config.js";

const config: NtfyBackendConfig = {
  topic: "t",
  server: "s",
  priority: "default",
  iconUrl: "https://example.com/icon.png",
};

// createNtfyBackend should return a NotificationBackend
const _check: NotificationBackend = createNtfyBackend(config);
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
