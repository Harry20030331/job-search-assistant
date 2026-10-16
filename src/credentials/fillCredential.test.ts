import { describe, expect, test } from "vitest";
import { fillCredential } from "./fillCredential.js";
import * as keychain from "./keychain.js";
import type { SecurityRunner } from "./keychain.js";

const reference = {
  provider: "workday",
  tenant: "example",
  account: "candidate@example.com"
};

describe("fillCredential", () => {
  test("does not expose a public API that can return or consume plaintext secrets", () => {
    expect(Object.keys(keychain)).toEqual([]);
  });

  test("uses an exact Keychain reference and restores the clipboard after pasting", async () => {
    const calls: Array<{ command: string; args: readonly string[]; shell: boolean }> = [];
    const runner: SecurityRunner = async (command, args, options) => {
      calls.push({ command, args, shell: options.shell });
      return { stdout: "top-secret\n" };
    };
    let clipboard = "original clipboard";
    const pasted: string[] = [];

    const result = await fillCredential(reference, {
      runner,
      clipboard: {
        readText: async () => clipboard,
        writeText: async (value) => { clipboard = value; },
        clear: async () => { clipboard = ""; }
      },
      pasteFocusedField: async () => { pasted.push(clipboard); }
    });

    expect(result).toEqual({ filled: true });
    expect(calls).toEqual([{
      command: "/usr/bin/security",
      args: ["find-generic-password", "-s", "workday:example", "-a", "candidate@example.com", "-w"],
      shell: false
    }]);
    expect(pasted).toEqual(["top-secret"]);
    expect(clipboard).toBe("original clipboard");
    expect(JSON.stringify(result)).not.toContain("top-secret");
  });

  test("clears an initially empty clipboard when paste fails without exposing the secret", async () => {
    const secret = "never-publish-this";
    const runner: SecurityRunner = async () => ({ stdout: secret });
    let clipboard = "";
    const operations: string[] = [];

    const result = await fillCredential(reference, {
      runner,
      clipboard: {
        readText: async () => clipboard,
        writeText: async (value) => { operations.push("write"); clipboard = value; },
        clear: async () => { operations.push("clear"); clipboard = ""; }
      },
      pasteFocusedField: async () => { throw new Error(`paste rejected ${secret}`); }
    });

    expect(result).toEqual({ filled: false });
    expect(operations).toEqual(["write", "clear"]);
    expect(clipboard).toBe("");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("returns only a failure flag when Keychain lookup fails", async () => {
    const secret = "leaked-by-runner";
    const runner: SecurityRunner = async () => { throw new Error(secret); };
    let clipboard = "keep me";

    const result = await fillCredential(reference, {
      runner,
      clipboard: {
        readText: async () => clipboard,
        writeText: async (value) => { clipboard = value; },
        clear: async () => { clipboard = ""; }
      },
      pasteFocusedField: async () => { throw new Error("must not paste"); }
    });

    expect(result).toEqual({ filled: false });
    expect(clipboard).toBe("keep me");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("clears the clipboard when restoring its previous value fails", async () => {
    const secret = "must-not-remain";
    const runner: SecurityRunner = async () => ({ stdout: secret });
    let clipboard = "original clipboard";
    let writes = 0;
    let clears = 0;

    const result = await fillCredential(reference, {
      runner,
      clipboard: {
        readText: async () => clipboard,
        writeText: async (value) => {
          writes += 1;
          if (writes === 2) throw new Error(`restore failed after ${secret}`);
          clipboard = value;
        },
        clear: async () => { clears += 1; clipboard = ""; }
      },
      pasteFocusedField: async () => {}
    });

    expect(result).toEqual({ filled: false });
    expect(clears).toBe(1);
    expect(clipboard).toBe("");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("returns a fixed public failure when restore and fallback clear both fail", async () => {
    const secret = "private-even-on-double-failure";
    const runner: SecurityRunner = async () => ({ stdout: secret });
    let writes = 0;

    const result = await fillCredential(reference, {
      runner,
      clipboard: {
        readText: async () => "original clipboard",
        writeText: async () => {
          writes += 1;
          if (writes === 2) throw new Error(`restore exposed ${secret}`);
        },
        clear: async () => { throw new Error(`clear exposed ${secret}`); }
      },
      pasteFocusedField: async () => {}
    });

    expect(result).toEqual({ filled: false });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
