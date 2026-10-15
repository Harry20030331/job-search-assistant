import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { fillCredential } from "../credentials/fillCredential.js";

export interface CredentialCliArgs {
  provider: string;
  tenant: string;
  account: string;
}

export function parseCredentialArgs(argv: readonly string[]): CredentialCliArgs {
  if (argv.length !== 6) throw new Error("invalid_arguments");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || values.has(flag)) throw new Error("invalid_arguments");
    values.set(flag, value);
  }
  if (
    values.size !== 3 ||
    !values.has("--provider") ||
    !values.has("--tenant") ||
    !values.has("--account")
  ) throw new Error("invalid_arguments");
  return {
    provider: values.get("--provider")!,
    tenant: values.get("--tenant")!,
    account: values.get("--account")!
  };
}

export interface ProcessOptions {
  shell: false;
  input?: string;
}

export type ProcessRunner = (
  command: string,
  args: readonly string[],
  options: ProcessOptions
) => Promise<{ stdout: string }>;

export const runProcess: ProcessRunner = (command, args, options) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, [...args], { shell: options.shell, stdio: ["pipe", "pipe", "ignore"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) resolvePromise({ stdout });
    else reject(new Error("command_failed"));
  });
  child.stdin.end(options.input ?? "");
});

export interface CredentialFillCliDependencies {
  runner: ProcessRunner;
  write(value: string): void;
}

export async function runCredentialFillCli(
  argv: readonly string[],
  dependencies: CredentialFillCliDependencies = {
    runner: runProcess,
    write: (value) => process.stdout.write(value)
  }
): Promise<number> {
  let filled = false;
  try {
    const reference = parseCredentialArgs(argv);
    const result = await fillCredential(reference, {
      runner: (command, args, options) => dependencies.runner(command, args, options),
      clipboard: {
        readText: async () => (await dependencies.runner("/usr/bin/pbpaste", [], { shell: false })).stdout,
        writeText: async (input) => { await dependencies.runner("/usr/bin/pbcopy", [], { shell: false, input }); },
        clear: async () => { await dependencies.runner("/usr/bin/pbcopy", [], { shell: false, input: "" }); }
      },
      pasteFocusedField: async () => {
        await dependencies.runner(
          "/usr/bin/osascript",
          ["-e", "tell application \"System Events\" to keystroke \"v\" using command down"],
          { shell: false }
        );
      }
    });
    filled = result.filled;
  } catch {
    filled = false;
  }
  dependencies.write(`${JSON.stringify({ filled })}\n`);
  return filled ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runCredentialFillCli(process.argv.slice(2));
}
