const huaweiPattern = /华为/i;
const roboticsPattern = /\bVLA\b|具身智能|机器人|遥操|运动控制|Sim2Real|强化学习算法/i;
const agentPattern = /AI\s*Agent|Agent\s*Infra|Agentic|Harness|Runtime|智能体|后训练.*Agent|Agent.*后训练/i;
const unrelatedPattern = /教育|老师|教练|录题|兼职|量化|销售|运营/i;

const companyPatterns: Array<[InboundCompanyTier, RegExp]> = [
  ["big_tech", /阿里|阿里云|腾讯|字节|美团|百度|小米|京东|华为/i],
  ["top_ai_startup", /DeepSeek|深度求索|月之暗面|MiniMax|智谱/i],
  ["top_robotics", /宇树|智元|银河通用|逐际动力|傅利叶|星海图|千寻|元戎启行/i]
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
