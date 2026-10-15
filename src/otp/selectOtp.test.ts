import { describe, expect, test } from "vitest";
import { selectOtp, type OtpArtifact, type OtpContext } from "./selectOtp.js";

const now = new Date("2026-08-05T18:00:00.000Z");
const context: OtpContext = {
  recipient: "candidate@example.com",
  tenant: "example-workday",
  sender: "no-reply@example-workday.com",
  expectedRedirectDomain: "example.wd5.myworkdayjobs.com",
  now
};

function artifact(overrides: Partial<OtpArtifact> = {}): OtpArtifact {
  return {
    codeCandidates: ["123456"],
    recipient: context.recipient,
    tenant: context.tenant,
    sender: context.sender,
    spf: "pass",
    dkim: "pass",
    dmarc: "pass",
    receivedAt: new Date(now.getTime() - 5 * 60_000),
    redirectDomain: context.expectedRedirectDomain,
    ...overrides
  };
}

describe("selectOtp", () => {
  test("selects one exact, authenticated six-digit artifact inside the timing window", () => {
    expect(selectOtp([artifact()], context)).toEqual({ status: "selected", code: "123456" });
  });

  test.each([
    ["code", { codeCandidates: ["12345"] }],
    ["recipient", { recipient: "other@example.com" }],
    ["tenant", { tenant: "other-workday" }],
    ["sender", { sender: "attacker@example.net" }],
    ["SPF authentication", { spf: "fail" }],
    ["DKIM authentication", { dkim: "fail" }],
    ["DMARC authentication", { dmarc: "fail" }],
    ["timing", { receivedAt: new Date(now.getTime() - 15 * 60_000 - 1) }],
    ["future timing", { receivedAt: new Date(now.getTime() + 1) }],
    ["redirect domain", { redirectDomain: "attacker.example.net" }]
  ] satisfies Array<[string, Partial<OtpArtifact>]>) (
    "returns review when %s does not match exactly",
    (_label, override) => {
      expect(selectOtp([artifact(override)], context)).toEqual({ status: "review", reason: "no_matching_otp" });
    }
  );

  test("returns deterministic review when more than one artifact matches", () => {
    expect(selectOtp([
      artifact({ codeCandidates: ["123456"] }),
      artifact({ codeCandidates: ["654321"], receivedAt: new Date(now.getTime() - 1_000) })
    ], context)).toEqual({ status: "review", reason: "ambiguous_otp" });
  });

  test("returns review when one matching message contains multiple six-digit candidates", () => {
    expect(selectOtp([
      artifact({ codeCandidates: ["123456", "654321"] })
    ], context)).toEqual({ status: "review", reason: "ambiguous_otp" });
  });

  test("accepts an artifact exactly fifteen minutes old", () => {
    expect(selectOtp([
      artifact({ receivedAt: new Date(now.getTime() - 15 * 60_000) })
    ], context)).toEqual({ status: "selected", code: "123456" });
  });
});
