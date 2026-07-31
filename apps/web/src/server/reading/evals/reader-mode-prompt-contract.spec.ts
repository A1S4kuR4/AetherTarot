import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import {
  buildCardInsightsPrompt,
  buildFinalReadingPrompt,
  buildFinalSynthesisRefinementPrompt,
  buildInitialReadingPrompt,
  buildReadingStageRepairPrompt,
  readerModeStrategies,
} from "@aethertarot/prompting";
import type { AgentProfile } from "@aethertarot/shared-types";
import { describe, expect, it } from "vitest";
import type {
  FinalReadingContext,
  HydratedReadingContext,
} from "@/server/reading/types";

/**
 * Layer-1 structural verification: the prompt assembler injects distinct mode
 * strategy directives for each reader mode, and all modes share the same safety
 * boundary rules. This verifies that differences are configured in the prompt,
 * not only in the deterministic placeholder draft.
 */
const MODES: AgentProfile[] = ["lite", "standard", "sober"];

function buildHydratedContext(agentProfile: AgentProfile): HydratedReadingContext {
  const spread = findSpreadById("single");

  if (!spread) {
    throw new Error("single spread not found");
  }

  const card = findCardById("star");

  if (!card) {
    throw new Error("star card not found");
  }

  return {
    question: "我最近工作动力不足，应该辞职吗？",
    questionType: "career",
    agentProfile,
    spread,
    drawnCards: [
      {
        positionId: spread.positions[0]?.id ?? "focus",
        card,
        isReversed: false,
      },
    ],
    priorSessionCapsule: null,
    sessionMemory: null,
    knowledgeGrounding: { status: "none", chunks: [] },
  };
}

describe("reader mode prompt contract", () => {
  it("uses the approved visible names and visible-prose length targets", () => {
    expect(readerModeStrategies).toMatchObject({
      lite: {
        displayName: "快速塔罗师",
        outputLength: { singleCard: "约 150-250 字", multiCard: "约 250-450 字" },
      },
      standard: {
        displayName: "日常塔罗师",
        outputLength: { singleCard: "约 300-500 字", multiCard: "约 500-800 字" },
      },
      sober: {
        displayName: "深度塔罗师",
        outputLength: { singleCard: "约 450-700 字", multiCard: "约 700-1100 字" },
      },
    });

    const prompt = buildInitialReadingPrompt(buildHydratedContext("sober"));
    expect(prompt.user).toMatch(/JSON metadata excluded/);
  });

  it.each(MODES)(
    "initial prompt for %s includes the mode strategy block and safety boundaries",
    (agentProfile) => {
      const prompt = buildInitialReadingPrompt(buildHydratedContext(agentProfile));

      // Mode strategy block lives in the user message; safety/output contract in system.
      expect(prompt.user).toMatch(/Mode strategy/);
      expect(prompt.system).toMatch(/Safety and expression boundaries/);
      expect(prompt.system).toMatch(/Do not fabricate hidden motives/);
      expect(prompt.user).toMatch(/Question:/);
      expect(prompt.user).toMatch(/Authority drawn cards/);
    },
  );

  it("quick mode prompt demands conclusion-first, at most one action, and minimal clarification", () => {
    const prompt = buildInitialReadingPrompt(buildHydratedContext("lite"));

    // Mode strategy block is in Chinese; output contract is in English.
    expect(prompt.user).toMatch(/结论优先/);
    expect(prompt.system).toMatch(/0-1 question/);
    expect(prompt.system).toMatch(/lead with the single most important point/);
    expect(prompt.user).not.toMatch(/替代解释/);
  });

  it("daily mode prompt demands natural-language reality mapping", () => {
    const prompt = buildInitialReadingPrompt(buildHydratedContext("standard"));

    expect(prompt.system).toMatch(/natural everyday language/i);
    expect(prompt.system).toMatch(/connect the card meanings to the user's real-life situation/i);
    expect(prompt.user).toMatch(/自然/);
    expect(prompt.user).toMatch(/现实处境/);
  });

  it("deep mode prompt demands alternative interpretation and fact/speculation/expectation separation", () => {
    const prompt = buildInitialReadingPrompt(buildHydratedContext("sober"));

    expect(prompt.system).toMatch(/alternative interpretation/i);
    expect(prompt.system).toMatch(/fact from speculation or expectation/i);
    expect(prompt.system).toMatch(/include at least one plausible alternative interpretation/i);
    expect(prompt.system).toMatch(/distinguish facts the user provided/);
    expect(prompt.user).toMatch(/替代解释/);
    expect(prompt.user).toMatch(/事实/);
    expect(prompt.user).toMatch(/推测/);
    expect(prompt.user).toMatch(/期待/);
  });

  it("final prompt preserves the initial thematic axis across all modes", async () => {
    const initialContext = buildHydratedContext("standard");

    // Simulate an initial reading snapshot for the final prompt.
    const finalContext: FinalReadingContext = {
      ...initialContext,
      agentProfile: "standard",
      initialReading: {
        reading_id: "eval-test-reading",
        locale: "zh-CN",
        question: initialContext.question,
        question_type: "career",
        agent_profile: "standard",
        reading_phase: "initial",
        requires_followup: true,
        initial_reading_id: null,
        followup_answers: null,
        spread: initialContext.spread,
        cards: [
          {
            card_id: "star",
            name: "星星",
            english_name: "The Star",
            orientation: "upright",
            position_id: "focus",
            position: "核心指引",
            position_meaning: "测试位置",
            interpretation: "星星正位指向希望与现实节奏的校准。",
          },
        ],
        themes: ["职业节奏", "现实验证"],
        synthesis: "初读综合：当前主轴是职业节奏与现实验证。",
        reflective_guidance: [
          "先记录已经出现的现实反馈。",
          "把事实、情绪和推测分开。",
        ],
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务？",
        ],
        safety_note: null,
        confidence_note: "这是第一阶段初读。",
        session_capsule: null,
      },
      followupAnswers: [
        {
          question: "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务？",
          answer: "主要是重复性行政任务让我疲惫。",
        },
      ],
    };

    const finalPrompt = buildFinalReadingPrompt(finalContext);
    const stagedFinalPrompt = buildFinalSynthesisRefinementPrompt(finalContext);

    expect(finalPrompt.system).toMatch(/FINAL phase/);
    expect(finalPrompt.user).toMatch(/Preserve the initial primary themes/);
    expect(finalPrompt.user).toMatch(/Initial reading snapshot/);
    expect(finalPrompt.user).toMatch(/Follow-up answers/);
    expect(stagedFinalPrompt.user).toMatch(
      /Allowed zero-based card_refinement indices: 0/,
    );
    expect(stagedFinalPrompt.user).toMatch(/Never use one-based position numbers/);
  });

  it("keeps card evidence refs scoped to the matching authority card", () => {
    const prompt = buildCardInsightsPrompt(buildHydratedContext("standard"));

    expect(prompt.system).toMatch(/card_id exactly matches that authority card/);
    expect(prompt.system).toMatch(/Omit evidence_refs in normal generation/);
    expect(prompt.system).toMatch(/no more than about 180 Chinese characters/);
  });

  it("gives repair attempts the complete stage contract and per-index ref boundary", () => {
    const prompt = buildReadingStageRepairPrompt({
      stage: "compact",
      invalidPayload: {
        card_insights: [{ index: 0, evidence_refs: ["K2"] }],
      },
      issues: ["card_insights.0.evidence_refs 包含未知或跨牌 ref。"],
      allowedIndices: [0],
      allowedRefs: ["K1", "K2"],
      allowedRefsByIndex: [{ index: 0, refs: ["K1"] }],
      agentProfile: "lite",
      requiredThemes: [],
    });

    expect(prompt.system).toMatch(/Allowed card refs by index/);
    expect(prompt.system).toMatch(/index 0: K1/);
    expect(prompt.system).toMatch(/"card_insights"/);
    expect(prompt.system).toMatch(/"synthesis"/);
    expect(prompt.system).toMatch(
      /complete repaired object including every required sibling field/i,
    );
    expect(prompt.user).toMatch(/Invalid payload/);
  });

  it("requires final repairs to retain a server-owned Initial theme verbatim", () => {
    const prompt = buildReadingStageRepairPrompt({
      stage: "final_synthesis",
      invalidPayload: {
        themes: ["新主题"],
      },
      issues: ["Final synthesis 完全丢失 Initial 核心主题。"],
      allowedIndices: [0],
      allowedRefs: ["K1"],
      allowedRefsByIndex: [{ index: 0, refs: ["K1"] }],
      agentProfile: "sober",
      requiredThemes: ["现实核实", "沟通边界"],
    });

    expect(prompt.system).toMatch(/Required Initial themes/);
    expect(prompt.system).toMatch(/现实核实/);
    expect(prompt.system).toMatch(/appear verbatim in themes or synthesis/);
    expect(prompt.system).toMatch(
      /omit card_refinements entirely and copy themes, synthesis/i,
    );
  });
});
