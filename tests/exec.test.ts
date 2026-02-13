import { describe, it, expect } from "vitest";
import type { PluginInput } from "@opencode-ai/plugin";
import { resolveField } from "../src/exec.js";

type BunShell = PluginInput["$"];

function createMockShell(
  handler: (command: string) => { stdout: string; exitCode: number }
): BunShell {
  const shell = ((strings: TemplateStringsArray, ...expressions: unknown[]) => {
    // Reconstruct the command from template literal parts
    // Handle { raw: string } expressions like the real Bun $ shell does
    let command = strings[0];
    for (let i = 0; i < expressions.length; i++) {
      const expr = expressions[i];
      if (expr && typeof expr === "object" && "raw" in expr && typeof (expr as any).raw === "string") {
        command += (expr as { raw: string }).raw;
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

    const shellPromise = {
      then: (resolve?: (value: any) => unknown, reject?: (reason: unknown) => unknown) => {
        if (result.exitCode !== 0) {
          const error = Object.assign(new Error(`Command failed with exit code ${result.exitCode}`), output);
          return Promise.reject(error).then(resolve as any, reject);
        }
        return Promise.resolve(output).then(resolve as any, reject);
      },
      catch: (reject?: (reason: unknown) => unknown) => {
        if (result.exitCode !== 0) {
          const error = Object.assign(new Error(`Command failed`), output);
          return Promise.reject(error).catch(reject);
        }
        return Promise.resolve(output).catch(reject);
      },
      quiet: function () { return this; },
      text: () => Promise.resolve(result.stdout),
      nothrow: function () {
        return {
          ...shellPromise,
          then: (resolve?: (value: any) => unknown, reject?: (reason: unknown) => unknown) => {
            return Promise.resolve(output).then(resolve as any, reject);
          },
          catch: (reject?: (reason: unknown) => unknown) => {
            return Promise.resolve(output).catch(reject);
          },
          text: () => Promise.resolve(result.stdout),
        };
      },
      [Symbol.asyncIterator]: undefined,
    };

    return shellPromise;
  }) as unknown as BunShell;

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
      'echo "${PROJECT} - ${EVENT}"',
      { PROJECT: "my-project", EVENT: "session.idle", TIME: "2026-01-01T00:00:00Z" },
      "fallback"
    );

    expect(executedCommand).toBe('echo "my-project - session.idle"');
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
      'echo "${PROJECT} ${ERROR}"',
      { PROJECT: "my-project" },
      "fallback"
    );

    expect(executedCommand).toBe('echo "my-project "');
    expect(result).toBe("result");
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
