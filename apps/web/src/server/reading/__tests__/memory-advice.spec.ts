import type { StructuredReading } from "@aethertarot/shared-types";
import { describe, expect, it } from "vitest";
import { buildLastAdviceSummary, runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import {
  extractLastAdviceSummary,
  GENERIC_LAST_ADVICE_FALLBACK,
} from "@/server/reading/memory-advice";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import {
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";

function buildReading(
  overrides: Partial<StructuredReading> = {},
): StructuredReading {
  return {
    reading_id: "reading-memory-advice",
    locale: "zh-CN",
    question: "我在职业上是不是该离职？",
    question_type: "career",
    agent_profile: "lite",
    reading_phase: "initial",
    requires_followup: false,
    initial_reading_id: null,
    followup_answers: null,
    spread: {
      id: "single",
      name: "单牌启示",
      englishName: "Single Card",
      description: "单牌聚焦当前议题。",
      icon: "sparkles",
      positions: [
        {
          id: "focus",
          name: "核心指引",
          description: "当前最值得观察的核心线索。",
        },
      ],
    },
    cards: [
      {
        card_id: "hanged-man",
        name: "倒吊人",
        english_name: "The Hanged Man",
        orientation: "reversed",
        position_id: "focus",
        position: "核心指引",
        position_meaning: "当前最值得观察的核心线索。",
        interpretation: "倒吊人逆位在这里提示行动节奏需要被重新校准。",
      },
    ],
    themes: ["行动节奏"],
    synthesis: "综合来看，先把现实条件看清，再决定下一步。",
    reflective_guidance: [
      "先和可靠同事确认岗位信息，再决定是否投递。",
      "把冲动行动换成一周内可验证的小动作。",
    ],
    follow_up_questions: [],
    safety_note: null,
    confidence_note: null,
    session_capsule: null,
    sober_check: null,
    presentation_mode: "standard",
    ...overrides,
  };
}

describe("memory advice extraction", () => {
  it("keeps extractLastAdviceSummary narrowed to reading-derived input", () => {
    const reading = buildReading();

    expect(extractLastAdviceSummary({ reading })).toBe(
      "先和可靠同事确认岗位信息，再决定是否投递。 把冲动行动换成一周内可验证的小动作。",
    );

    if (false) {
      // @ts-expect-error P7.5 intentionally removed topic/cards metadata.
      extractLastAdviceSummary({ reading, topic: "career", cards: [] });
    }
  });

  it("extracts last_advice_summary from structured reflective guidance first", () => {
    const reading = buildReading();

    expect(extractLastAdviceSummary({ reading })).toBe(
      "先和可靠同事确认岗位信息，再决定是否投递。 把冲动行动换成一周内可验证的小动作。",
    );
  });

  it("falls back to synthesis when guidance fields are empty", () => {
    const reading = buildReading({
      synthesis: "综合来看，先保持观察，再把真正的问题拆清楚。第二句不应优先进入摘要。",
      reflective_guidance: [],
    });

    expect(extractLastAdviceSummary({ reading })).toBe(
      "综合来看，先保持观察，再把真正的问题拆清楚。",
    );
  });

  it("returns undefined when no reading-derived advice text is usable", () => {
    const reading = buildReading({
      synthesis: "   ",
      reflective_guidance: ["   "],
    });

    expect(extractLastAdviceSummary({ reading })).toBeUndefined();
  });

  it("uses generic fallback instead of a card-topic hardcoded rule when extraction fails", () => {
    const reading = buildReading({
      synthesis: "",
      reflective_guidance: [],
    });

    expect(buildLastAdviceSummary(reading)).toBe(GENERIC_LAST_ADVICE_FALLBACK);
  });

  it("truncates long reading-derived advice instead of storing full text", () => {
    const longAdvice = `建议先整理事实，再${"非常谨慎地".repeat(40)}推进。`;
    const reading = buildReading({
      synthesis: "",
      reflective_guidance: [longAdvice],
    });
    const summary = extractLastAdviceSummary({ reading });

    expect(summary).toBeTruthy();
    expect(summary?.length).toBeLessThanOrEqual(72);
    expect(summary).toMatch(/…$/);
    expect(summary).not.toBe(longAdvice);
  });

  it("memory_advice_extraction_prefers_reading_output", async () => {
    const sessionMemoryStore = createInMemorySessionMemoryStore();
    const advice = "本轮实际建议：先整理作品集，再用一周测试投递节奏。";
    const secondaryAdvice =
      "第二条建议只用于满足结构化输出数量，不应覆盖第一条建议摘要。";
    const expectedSummary = `${advice} ${secondaryAdvice}`;
    const provider = new TestReadingProvider({
      initial: (draft) => ({
        ...draft,
        reflective_guidance: [
          advice,
          secondaryAdvice,
        ],
      }),
    });

    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我在职业上是不是该离职？"),
        drawnCards: [
          {
            positionId: "focus",
            cardId: "hanged-man",
            isReversed: true,
          },
        ],
        thread_id: "memory-advice-thread",
        agent_profile: "lite",
      },
      { provider, sessionMemoryStore },
    );
    const stored = await sessionMemoryStore.get("memory-advice-thread");

    expect(stored?.last_advice_summary).toBe(expectedSummary);
    expect(stored?.last_advice_summary).not.toBe("先识别卡点，不要冲动行动。");
    expect(result.agentState.tool_calls.at(-1)).toMatchObject({
      tool_name: "write_session_memory",
      ok: true,
    });
    expect(JSON.stringify(result.trace)).not.toContain(expectedSummary);
  });
});
