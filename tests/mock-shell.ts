import type { PluginInput } from "@opencode-ai/plugin";

type BunShell = PluginInput["$"];

function isRawExpression(expr: unknown): expr is { raw: string } {
  if (typeof expr !== "object" || expr === null) return false;
  if (!("raw" in expr)) return false;
  return typeof expr.raw === "string";
}

/**
 * Creates a mock BunShell that satisfies the full BunShell interface without
 * type casts. The handler receives the reconstructed command string and returns
 * the desired stdout and exit code.
 */
export function createMockShell(
  handler?: (command: string) => { stdout: string; exitCode: number }
): BunShell {
  const actualHandler = handler ?? (() => ({ stdout: "", exitCode: 0 }));

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

      const result = actualHandler(command);
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
