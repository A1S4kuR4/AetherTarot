import { describe, expect, it } from "vitest";
import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import {
  hydrateStagedReadingDraft,
  normalizeCardInsightsPayload,
  normalizeFinalSynthesisPayload,
  normalizeSynthesisPayload,
} from "@/server/reading/generation-contracts";
import type { HydratedReadingContext } from "@/server/reading/types";

function buildContext(): HydratedReadingContext {
  const spread = findSpreadById("holy-triangle");
  const cards = ["high-priestess", "hermit", "star"].map(findCardById);
  if (!spread || cards.some((card) => !card)) {
    throw new Error("missing test authority data");
  }
  return {
    question: "我该如何看待当前的职业选择？",
    questionType: "career",
    agentProfile: "standard",
    spread,
    drawnCards: spread.positions.map((position, index) => ({
      positionId: position.id,
      card: cards[index]!,
      isReversed: index === 2,
    })),
    priorSessionCapsule: null,
    sessionMemory: null,
    knowledgeGrounding: {
      status: "retrieved",
      chunks: cards.map((card, index) => ({
        id: `chunk-${index}`,
        title: `title-${index}`,
        content: `content-${index}`,
        source: `source-${index}`,
        source_ids: [`source-${index}`],
        ref: `ref-${index}`,
        kind: "wiki",
        card: card!.id,
        orientation: index === 2 ? "reversed" : "upright",
        score: 1,
        confidence: "high",
      })),
    },
  };
}

function validInsights() {
  return [
    { index: 0, interpretation: "过去的位置提醒先听见尚未说清的判断。", evidence_refs: ["ref-0"] },
    { index: 1, interpretation: "现在的位置更适合独立梳理现实条件。", evidence_refs: ["ref-1"] },
    { index: 2, interpretation: "未来的位置显示希望感暂时向内收拢。", evidence_refs: ["ref-2"] },
  ];
}

function validSynthesis() {
  return {
    themes: ["先辨认方向", "核实现实条件"],
    synthesis: "整组牌把重点放在先安静辨认方向，再用现实反馈校准希望与顾虑之间的距离。",
    reflective_guidance: [
      "列出已经确认的事实。",
      "给仍待验证的判断设置观察点。",
      "选择一个低风险的小步骤。",
    ],
    follow_up_questions: ["哪个现实条件最需要先确认？"],
    confidence_note: "这些是当下的反思线索，仍需结合现实信息理解。",
    evidence_refs: ["ref-0", "ref-1", "ref-2"],
  };
}

describe("staged generation contracts", () => {
  it("requires exact authority index order and card-scoped refs", () => {
    const context = buildContext();
    expect(() => normalizeCardInsightsPayload({
      context,
      payload: {
        card_insights: validInsights().map((item, index) => ({
          ...item,
          index: index === 1 ? 2 : item.index,
        })),
      },
    })).toThrow(expect.objectContaining({ subtype: "authority_mismatch" }));

    expect(() => normalizeCardInsightsPayload({
      context,
      payload: {
        card_insights: validInsights().map((item, index) => ({
          ...item,
          evidence_refs: index === 0 ? ["ref-2"] : item.evidence_refs,
        })),
      },
    })).toThrow(expect.objectContaining({ subtype: "grounding_violation" }));
  });

  it("rejects an explicit orientation contradiction", () => {
    const context = buildContext();
    const insights = validInsights();
    insights[2] = {
      ...insights[2],
      interpretation: "这张牌处于正位，因此表达十分顺畅。",
    };
    expect(() => normalizeCardInsightsPayload({
      context,
      payload: { card_insights: insights },
    })).toThrow(expect.objectContaining({ subtype: "semantic_contradiction" }));
  });

  it("rejects synthesis that degenerates into per-card enumeration", () => {
    const context = buildContext();
    expect(() => normalizeSynthesisPayload({
      context,
      phase: "initial",
      payload: {
        ...validSynthesis(),
        synthesis: "1. 女祭司说明直觉。2. 隐者说明独处。3. 星星说明希望。",
      },
    })).toThrow(expect.objectContaining({ subtype: "schema_violation" }));
  });

  it("hydrates all public card metadata from server authority", () => {
    const context = buildContext();
    const cardInsights = normalizeCardInsightsPayload({
      context,
      payload: { card_insights: validInsights() },
    });
    const synthesis = normalizeSynthesisPayload({
      context,
      phase: "initial",
      payload: validSynthesis(),
    });
    const draft = hydrateStagedReadingDraft({
      context,
      cardInsights,
      synthesis,
    });

    expect(draft.cards.map((card) => ({
      id: card.card_id,
      position: card.position_id,
      orientation: card.orientation,
    }))).toEqual([
      { id: "high-priestess", position: "past", orientation: "upright" },
      { id: "hermit", position: "present", orientation: "upright" },
      { id: "star", position: "future", orientation: "reversed" },
    ]);
  });

  it("deterministically maps omitted staged refs by authority card index", () => {
    const context = buildContext();
    const cardInsights = normalizeCardInsightsPayload({
      context,
      payload: {
        card_insights: validInsights().map(({ index, interpretation }) => ({
          index,
          interpretation,
        })),
      },
    });
    const synthesis = normalizeSynthesisPayload({
      context,
      phase: "initial",
      payload: { ...validSynthesis(), evidence_refs: undefined },
    });

    expect(hydrateStagedReadingDraft({
      context,
      cardInsights,
      synthesis,
    }).grounding_claims).toEqual([
      { path: "cards.0.interpretation", source_refs: ["ref-0"] },
      { path: "cards.1.interpretation", source_refs: ["ref-1"] },
      { path: "cards.2.interpretation", source_refs: ["ref-2"] },
      { path: "synthesis", source_refs: ["ref-0", "ref-1", "ref-2"] },
    ]);
  });

  it("normalizes one follow-up string but still rejects unknown synthesis refs", () => {
    const context = buildContext();
    expect(normalizeSynthesisPayload({
      context,
      phase: "initial",
      payload: {
        ...validSynthesis(),
        follow_up_questions: "哪个现实条件最需要先确认？",
      },
    }).follow_up_questions).toEqual(["哪个现实条件最需要先确认？"]);

    expect(() => normalizeSynthesisPayload({
      context,
      phase: "initial",
      payload: { ...validSynthesis(), evidence_refs: ["unknown-ref"] },
    })).toThrow(expect.objectContaining({ subtype: "grounding_violation" }));
  });

  it("requires Final to retain an Initial core theme", () => {
    const context = buildContext();
    const initialReading = {
      reading_id: "initial-1",
      locale: "zh-CN",
      question: context.question,
      question_type: context.questionType,
      agent_profile: context.agentProfile,
      reading_phase: "initial",
      requires_followup: true,
      initial_reading_id: null,
      followup_answers: null,
      spread: context.spread,
      cards: hydrateStagedReadingDraft({
        context,
        cardInsights: validInsights(),
        synthesis: validSynthesis(),
      }).cards,
      ...validSynthesis(),
      safety_note: null,
      session_capsule: null,
      sober_check: null,
      presentation_mode: "standard",
    } as const;

    expect(() => normalizeFinalSynthesisPayload({
      context,
      initialReading,
      payload: {
        ...validSynthesis(),
        themes: ["完全不同", "另一个方向"],
        synthesis: "补充回答只说明了一组与原有主轴无关的新判断。",
        follow_up_questions: [],
      },
    })).toThrow(expect.objectContaining({ subtype: "semantic_contradiction" }));
  });

  it("accepts sparse Final card refinements and reuses every other Initial card", () => {
    const context = buildContext();
    const initialDraft = hydrateStagedReadingDraft({
      context,
      cardInsights: validInsights(),
      synthesis: validSynthesis(),
    });
    const initialReading = {
      reading_id: "initial-2",
      locale: "zh-CN",
      question: context.question,
      question_type: context.questionType,
      agent_profile: context.agentProfile,
      reading_phase: "initial",
      requires_followup: true,
      initial_reading_id: null,
      followup_answers: null,
      spread: context.spread,
      cards: initialDraft.cards,
      ...validSynthesis(),
      safety_note: null,
      session_capsule: null,
      sober_check: null,
      presentation_mode: "standard",
    } as const;
    const finalSynthesis = normalizeFinalSynthesisPayload({
      context,
      initialReading,
      payload: {
        ...validSynthesis(),
        follow_up_questions: [],
        card_refinements: [{
          index: 1,
          interpretation: "补充回答让现在的位置更明确地指向先核对合作边界。",
          evidence_refs: ["ref-1"],
        }],
      },
    });
    const finalDraft = hydrateStagedReadingDraft({
      context,
      cardInsights: finalSynthesis.card_refinements,
      synthesis: finalSynthesis,
      initialReading,
    });

    expect(finalDraft.cards[0]).toEqual(initialReading.cards[0]);
    expect(finalDraft.cards[1]).toMatchObject({
      card_id: initialReading.cards[1].card_id,
      position_id: initialReading.cards[1].position_id,
      orientation: initialReading.cards[1].orientation,
      interpretation: "补充回答让现在的位置更明确地指向先核对合作边界。",
    });
    expect(finalDraft.cards[2]).toEqual(initialReading.cards[2]);
  });
});
