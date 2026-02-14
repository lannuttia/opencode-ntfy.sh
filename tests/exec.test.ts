import { describe, it, expect } from "vitest";
import type { PluginInput } from "@opencode-ai/plugin";
import { resolveField } from "../src/exec.js";

type BunShell = PluginInput["$"];

function isRawExpression(expr: unknown): expr is { raw: string } {
  if (typeof expr !== "object" || expr === null) return false;
  if (!("raw" in expr)) return false;
  return typeof expr.raw === "string";
}

function createMockShell(
  handler: (command: string) => { stdout: string; exitCode: number }
): BunShell {
  const shell: BunShell = Object.assign(
    (strings: TemplateStringsArray, ...expressions: unknown[]) => {
      let command = strings[0];
      for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (isRawExpression(expr)) {
          command += expr.raw;
        } else {
          command += String(expr);
        }
        command += strings[i + 1];
      }

      const result = handler(command);
      const buf = Buffer.from(result.stdout);
      const output = {
        stdout: buf,
        stderr: Buffer.from(""),
        exitCode: result.exitCode,
        text: () => result.stdout,
        json: () => JSON.parse(result.stdout),
        arrayBuffer: () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        bytes: () => new Uint8Array(buf),
        blob: () => new Blob([buf]),
      };

      const shellPromise: ReturnType<BunShell> = Object.assign(
        Promise.resolve(output),
        {
          stdin: new WritableStream(),
          cwd: () => shellPromise,
          env: () => shellPromise,
          quiet: () => shellPromise,
          lines: () => (async function* () { yield result.stdout; })(),
          text: () => Promise.resolve(result.stdout),
          json: () => Promise.resolve(JSON.parse(result.stdout)),
          arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
          blob: () => Promise.resolve(new Blob([buf])),
          nothrow: () => shellPromise,
          throws: () => shellPromise,
        }
      );

      return shellPromise;
    },
    {
      braces: (pattern: string) => [pattern],
      escape: (input: string) => input,
      env: () => shell,
      cwd: () => shell,
      nothrow: () => shell,
      throws: () => shell,
    }
  );

  return shell;
}

describe("resolveField", () => {
  it("should return the fallback when command is undefined", async () => {
    const $ = createMockShell(() => ({ stdout: "", exitCode: 0 }));
    const result = await resolveField($, undefined, {}, "my-fallback");
    expect(result).toBe("my-fallback");
  });

  it("should return the fallback when command is an empty string", async () => {
    const $ = createMockShell(() => ({ stdout: "", exitCode: 0 }));
    const result = await resolveField($, "", {}, "my-fallback");
    expect(result).toBe("my-fallback");
  });

  it("should substitute template variables and return trimmed stdout", async () => {
    let executedCommand = "";
    const $ = createMockShell((cmd) => {
      executedCommand = cmd;
      return { stdout: "  custom title  \n", exitCode: 0 };
    });

    const result = await resolveField(
      $,
      'echo "${event} - ${time}"',
      { event: "session.idle", time: "2026-01-01T00:00:00Z" },
      "fallback"
    );

    expect(executedCommand).toBe('echo "session.idle - 2026-01-01T00:00:00Z"');
    expect(result).toBe("custom title");
  });

  it("should substitute unset variables with empty strings", async () => {
    let executedCommand = "";
    const $ = createMockShell((cmd) => {
      executedCommand = cmd;
      return { stdout: "result", exitCode: 0 };
    });

    const result = await resolveField(
      $,
      'echo "${event} ${error}"',
      { event: "session.idle" },
      "fallback"
    );

    expect(executedCommand).toBe('echo "session.idle "');
    expect(result).toBe("result");
  });

  it("should substitute underscored variable names like ${permission_type}", async () => {
    let executedCommand = "";
    const $ = createMockShell((cmd) => {
      executedCommand = cmd;
      return { stdout: "file.write: config.json", exitCode: 0 };
    });

    const result = await resolveField(
      $,
      'echo "${permission_type}: ${permission_patterns}"',
      { permission_type: "file.write", permission_patterns: "config.json" },
      "fallback"
    );

    expect(executedCommand).toBe('echo "file.write: config.json"');
    expect(result).toBe("file.write: config.json");
  });

  it("should return fallback when command exits with non-zero exit code", async () => {
    const $ = createMockShell(() => {
      return { stdout: "some output before failure", exitCode: 1 };
    });

    const result = await resolveField(
      $,
      "failing-command",
      {},
      "my-fallback"
    );

    expect(result).toBe("my-fallback");
  });

  it("should return fallback when command produces empty output", async () => {
    const $ = createMockShell(() => {
      return { stdout: "   \n", exitCode: 0 };
    });

    const result = await resolveField(
      $,
      "echo ''",
      {},
      "my-fallback"
    );

    expect(result).toBe("my-fallback");
  });
});
