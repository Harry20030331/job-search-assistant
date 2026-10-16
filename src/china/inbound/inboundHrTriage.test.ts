import { describe, expect, test } from "vitest";
import { classifyInboundContact } from "./inboundHrTriage.js";

describe("Boss inbound HR triage", () => {
  test("hard excludes Huawei even for Agent roles", () => {
    expect(classifyInboundContact({ company: "Huawei", messageSummary: "Full-time AI Agent Infra role" })).toMatchObject({
      direction: "agent", companyTier: "big_tech", status: "not_interested", nextAction: "none", reasonCode: "excluded_huawei"
    });
  });

  test("keeps known Agent companies", () => {
    expect(classifyInboundContact({ company: "Moonshot AI", messageSummary: "Agentic RL and General Agent" })).toMatchObject({
      direction: "agent", companyTier: "top_ai_startup", status: "interested", nextAction: "prepare_reply"
    });
  });

  test("classifies embodied roles only as robotics", () => {
    expect(classifyInboundContact({ company: "Unitree", messageSummary: "VLA embodied AI reinforcement learning" })).toMatchObject({
      direction: "robotics", companyTier: "top_robotics", status: "interested"
    });
  });

  test("asks for clarification when a credible company omits the role", () => {
    expect(classifyInboundContact({ company: "DeepRoute", messageSummary: "Interested in a 2027 graduate algorithm role?" })).toMatchObject({
      direction: "unclassified", status: "needs_clarification", nextAction: "ask_clarifying_question"
    });
  });

  test("rejects unrelated and generic headhunter outreach", () => {
    expect(classifyInboundContact({ company: "Example Recruiter", messageSummary: "Can we discuss a well-paid opportunity?" })).toMatchObject({
      companyTier: "other", status: "not_interested", nextAction: "none"
    });
  });
});
