// Legacy compatibility classifier. Unicode patterns match external employer text; all reports use English.
const huaweiPattern = /Huawei|\u534e\u4e3a/i;
const roboticsPattern = /\bVLA\b|embodied AI|robotics|teleoperation|motion control|reinforcement learning|\u5177\u8eab\u667a\u80fd|\u673a\u5668\u4eba|\u9065\u64cd|\u8fd0\u52a8\u63a7\u5236|Sim2Real|\u5f3a\u5316\u5b66\u4e60\u7b97\u6cd5/i;
const agentPattern = /intelligent agent|post-training.*Agent|Agent.*post-training|AI\s*Agent|Agent\s*Infra|Agentic|Harness|Runtime|\u667a\u80fd\u4f53|\u540e\u8bad\u7ec3.*Agent|Agent.*\u540e\u8bad\u7ec3/i;
const unrelatedPattern = /education|teacher|coach|part-time|quantitative trading|sales|operations|\u6559\u80b2|\u8001\u5e08|\u6559\u7ec3|\u5f55\u9898|\u517c\u804c|\u91cf\u5316|\u9500\u552e|\u8fd0\u8425/i;

const companyPatterns: Array<[InboundCompanyTier, RegExp]> = [
  ["big_tech", /Alibaba|Tencent|ByteDance|Meituan|Baidu|Xiaomi|JD\.com|Huawei|\u963f\u91cc|\u963f\u91cc\u4e91|\u817e\u8baf|\u5b57\u8282|\u7f8e\u56e2|\u767e\u5ea6|\u5c0f\u7c73|\u4eac\u4e1c|\u534e\u4e3a/i],
  ["top_ai_startup", /Moonshot AI|Zhipu|DeepSeek|\u6df1\u5ea6\u6c42\u7d22|\u6708\u4e4b\u6697\u9762|MiniMax|\u667a\u8c31/i],
  ["top_robotics", /Unitree|Agibot|Galbot|LimX|Fourier|Galaxea|Spirit AI|DeepRoute|\u5b87\u6811|\u667a\u5143|\u94f6\u6cb3\u901a\u7528|\u9010\u9645\u52a8\u529b|\u5085\u5229\u53f6|\u661f\u6d77\u56fe|\u5343\u5bfb|\u5143\u620e\u542f\u884c/i]
];

export type InboundCompanyTier = "big_tech" | "top_ai_startup" | "top_robotics" | "other";
export type InboundDirection = "agent" | "robotics" | "unclassified";
export type InboundStatus = "interested" | "needs_clarification" | "not_interested";
export type InboundNextAction = "prepare_reply" | "ask_clarifying_question" | "none";

export interface InboundTriageResult {
  direction: InboundDirection;
  companyTier: InboundCompanyTier;
  status: InboundStatus;
  nextAction: InboundNextAction;
  reasonCode: "excluded_huawei" | "matching_role" | "role_unclear" | "unrelated_role" | "unknown_company";
}

function determineCompanyTier(company: string): InboundCompanyTier {
  return companyPatterns.find(([, pattern]) => pattern.test(company))?.[0] ?? "other";
}

function determineDirection(messageSummary: string): InboundDirection {
  if (roboticsPattern.test(messageSummary)) return "robotics";
  if (agentPattern.test(messageSummary)) return "agent";
  return "unclassified";
}

export function classifyInboundContact(input: { company: string; messageSummary: string }): InboundTriageResult {
  const companyTier = determineCompanyTier(input.company);
  const direction = determineDirection(input.messageSummary);

  if (huaweiPattern.test(input.company)) {
    return { direction, companyTier, status: "not_interested", nextAction: "none", reasonCode: "excluded_huawei" };
  }
  if (unrelatedPattern.test(input.messageSummary)) {
    return { direction, companyTier, status: "not_interested", nextAction: "none", reasonCode: "unrelated_role" };
  }
  if (companyTier === "other") {
    return { direction, companyTier, status: "not_interested", nextAction: "none", reasonCode: "unknown_company" };
  }
  if (direction === "unclassified") {
    return { direction, companyTier, status: "needs_clarification", nextAction: "ask_clarifying_question", reasonCode: "role_unclear" };
  }
  return { direction, companyTier, status: "interested", nextAction: "prepare_reply", reasonCode: "matching_role" };
}
