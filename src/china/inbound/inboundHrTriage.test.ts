import { describe, expect, test } from "vitest";
import { classifyInboundContact } from "./inboundHrTriage.js";

describe("Boss inbound HR triage", () => {
  test("hard excludes Huawei even for Agent roles", () => {
    expect(classifyInboundContact({ company: "华为", messageSummary: "AI Agent Infra 正式岗位" })).toMatchObject({
      direction: "agent", companyTier: "big_tech", status: "not_interested", nextAction: "none", reasonCode: "excluded_huawei"
    });
  });

  test("keeps known Agent companies", () => {
    expect(classifyInboundContact({ company: "月之暗面", messageSummary: "Agentic RL 与 General Agent" })).toMatchObject({
      direction: "agent", companyTier: "top_ai_startup", status: "interested", nextAction: "prepare_reply"
    });
  });

  test("classifies embodied roles only as robotics", () => {
    expect(classifyInboundContact({ company: "宇树科技", messageSummary: "VLA 具身智能 强化学习" })).toMatchObject({
      direction: "robotics", companyTier: "top_robotics", status: "interested"
    });
  });

  test("asks for clarification when a credible company omits the role", () => {
    expect(classifyInboundContact({ company: "元戎启行", messageSummary: "2027届算法岗位，有兴趣吗" })).toMatchObject({
      direction: "unclassified", status: "needs_clarification", nextAction: "ask_clarifying_question"
    });
  });

  test("rejects unrelated and generic headhunter outreach", () => {
    expect(classifyInboundContact({ company: "某猎头", messageSummary: "有个高薪机会聊聊" })).toMatchObject({
      companyTier: "other", status: "not_interested", nextAction: "none"
    });
  });
});
