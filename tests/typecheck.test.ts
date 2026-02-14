import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readdirSync, readFileSync } from "node:fs";
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

  it("should not compile _typecheck_* files into dist when they exist in src", () => {
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

  it("should not contain type assertion casts (as) in src/ files", () => {
    const srcDir = join(ROOT, "src");
    const srcFiles = readdirSync(srcDir).filter(
      (f) => f.endsWith(".ts") && !f.startsWith("_typecheck_")
    );

    const castPattern = /\bas\s+(any|unknown|string|{\s*[^}]*}|[A-Z]\w*)/g;
    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = readFileSync(join(srcDir, file), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip import type statements (e.g. "import type { Foo } from ...")
        if (line.trimStart().startsWith("import")) continue;
        const matches = line.match(castPattern);
        if (matches) {
          for (const match of matches) {
            violations.push(`${file}:${i + 1}: ${match}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("should not contain type assertion casts (as) in tests/ files", () => {
    const testsDir = join(ROOT, "tests");
    const testFiles = readdirSync(testsDir).filter(
      (f) => f.endsWith(".ts")
    );

    const castPattern = /\bas\s+(any|unknown|string|{\s*[^}]*}|[A-Z]\w*)/g;
    const violations: string[] = [];

    for (const file of testFiles) {
      const content = readFileSync(join(testsDir, file), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip import type statements (e.g. "import type { Foo } from ...")
        if (line.trimStart().startsWith("import")) continue;
        const matches = line.match(castPattern);
        if (matches) {
          for (const match of matches) {
            violations.push(`${file}:${i + 1}: ${match}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
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
