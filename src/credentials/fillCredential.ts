import type { CredentialReference, SecurityRunner } from "./keychain.js";

export interface ClipboardAccess {
  readText(): Promise<string>;
  writeText(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface FillCredentialDependencies {
  runner: SecurityRunner;
  clipboard: ClipboardAccess;
  pasteFocusedField(): Promise<void>;
}

export interface FillCredentialResult {
  filled: boolean;
}

async function pasteKeychainCredential(
  reference: CredentialReference,
  dependencies: FillCredentialDependencies
): Promise<void> {
  const { stdout } = await dependencies.runner(
    "/usr/bin/security",
    [
      "find-generic-password",
      "-s", `${reference.provider}:${reference.tenant}`,
      "-a", reference.account,
      "-w"
    ],
    { shell: false }
  );
  await dependencies.clipboard.writeText(stdout.replace(/\r?\n$/, ""));
  await dependencies.pasteFocusedField();
}

export async function fillCredential(
  reference: CredentialReference,
  dependencies: FillCredentialDependencies
): Promise<FillCredentialResult> {
  let previousClipboard: string;
  try {
    previousClipboard = await dependencies.clipboard.readText();
  } catch {
    return { filled: false };
  }

  let filled = false;
  let clipboardTouched = false;
  let cleanupSucceeded = true;

  try {
    clipboardTouched = true;
    await pasteKeychainCredential(reference, dependencies);
    filled = true;
  } catch {
    filled = false;
  } finally {
    if (clipboardTouched) {
      try {
        if (previousClipboard.length > 0) await dependencies.clipboard.writeText(previousClipboard);
        else await dependencies.clipboard.clear();
      } catch {
        cleanupSucceeded = false;
        try {
          await dependencies.clipboard.clear();
        } catch {
          // Public failure remains fixed even if the clipboard provider also rejects cleanup.
        }
      }
    }
  }

  return { filled: filled && cleanupSucceeded };
}
