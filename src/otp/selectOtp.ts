export interface OtpArtifact {
  codeCandidates: readonly string[];
  recipient: string;
  tenant: string;
  sender: string;
  spf: "pass" | "fail" | "none";
  dkim: "pass" | "fail" | "none";
  dmarc: "pass" | "fail" | "none";
  receivedAt: Date;
  redirectDomain: string;
}

export interface OtpContext {
  recipient: string;
  tenant: string;
  sender: string;
  expectedRedirectDomain: string;
  now: Date;
}

export type OtpSelection =
  | { status: "selected"; code: string }
  | { status: "review"; reason: "no_matching_otp" | "ambiguous_otp" };

const maximumAgeMs = 15 * 60_000;

export function selectOtp(artifacts: readonly OtpArtifact[], context: OtpContext): OtpSelection {
  const nowMs = context.now.getTime();
  const candidates = artifacts.flatMap((artifact) => {
    const ageMs = nowMs - artifact.receivedAt.getTime();
    const trusted = artifact.recipient === context.recipient
      && artifact.tenant === context.tenant
      && artifact.sender === context.sender
      && artifact.spf === "pass"
      && artifact.dkim === "pass"
      && artifact.dmarc === "pass"
      && Number.isFinite(ageMs)
      && ageMs >= 0
      && ageMs <= maximumAgeMs
      && artifact.redirectDomain === context.expectedRedirectDomain;
    if (!trusted) return [];
    return artifact.codeCandidates.filter((candidate) => /^\d{6}$/.test(candidate));
  });

  if (candidates.length === 0) return { status: "review", reason: "no_matching_otp" };
  if (candidates.length !== 1) return { status: "review", reason: "ambiguous_otp" };
  return { status: "selected", code: candidates[0]! };
}
