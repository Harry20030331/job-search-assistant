import { describe, expect, test, vi } from "vitest";
import { parseCredentialArgs, runCredentialFillCli, type ProcessRunner } from "./credentialFillCli.js";

describe("credential fill CLI", () => {
  test("parses an exact provider, tenant, and account reference", () => {
    expect(parseCredentialArgs([
      "--provider", "workday",
      "--tenant", "example",
      "--account", "candidate@example.com"
    ])).toEqual({ provider: "workday", tenant: "example", account: "candidate@example.com" });
  });

  test.each([
    { args: [] },
    { args: ["--provider", "workday", "--tenant", "example"] },
    { args: ["--provider", "workday", "--tenant", "example", "--account", "candidate@example.com", "--secret", "bad"] }
  ])("rejects incomplete or unknown arguments: $args", ({ args }) => {
    expect(() => parseCredentialArgs(args)).toThrow("invalid_arguments");
  });

  test("composes only fixed absolute commands with shell disabled and restores the clipboard", async () => {
    const calls: Array<{ command: string; args: readonly string[]; shell: false; input?: string }> = [];
    const secret = "never-print-me";
    const runner: ProcessRunner = vi.fn(async (command, args, options) => {
      calls.push({ command, args, ...options });
      if (command === "/usr/bin/pbpaste") return { stdout: "original clipboard" };
      if (command === "/usr/bin/security") return { stdout: `${secret}\n` };
      return { stdout: "" };
    });
    const writes: string[] = [];

    const exitCode = await runCredentialFillCli(
      ["--provider", "workday", "--tenant", "example", "--account", "candidate@example.com"],
      { runner, write: (value) => writes.push(value) }
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      { command: "/usr/bin/pbpaste", args: [], shell: false },
      {
        command: "/usr/bin/security",
        args: ["find-generic-password", "-s", "workday:example", "-a", "candidate@example.com", "-w"],
        shell: false
      },
      { command: "/usr/bin/pbcopy", args: [], shell: false, input: secret },
      {
        command: "/usr/bin/osascript",
        args: ["-e", "tell application \"System Events\" to keystroke \"v\" using command down"],
        shell: false
      },
      { command: "/usr/bin/pbcopy", args: [], shell: false, input: "original clipboard" }
    ]);
    expect(writes).toEqual([`${JSON.stringify({ filled: true })}\n`]);
    expect(writes.join("")).not.toContain(secret);
  });

  test("prints only a fixed failure result when a command rejects with secret material", async () => {
    const secret = "runner-secret";
    const writes: string[] = [];
    const exitCode = await runCredentialFillCli(
      ["--provider", "workday", "--tenant", "example", "--account", "candidate@example.com"],
      {
        runner: async (command) => {
          if (command === "/usr/bin/pbpaste") return { stdout: "original" };
          throw new Error(secret);
        },
        write: (value) => writes.push(value)
      }
    );

    expect(exitCode).toBe(1);
    expect(writes).toEqual([`${JSON.stringify({ filled: false })}\n`]);
    expect(writes.join("")).not.toContain(secret);
  });
});
