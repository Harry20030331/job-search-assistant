export interface CredentialReference {
  provider: string;
  tenant: string;
  account: string;
}

export interface SecurityRunnerOptions {
  shell: false;
}

export type SecurityRunner = (
  command: "/usr/bin/security",
  args: readonly string[],
  options: SecurityRunnerOptions
) => Promise<{ stdout: string }>;
