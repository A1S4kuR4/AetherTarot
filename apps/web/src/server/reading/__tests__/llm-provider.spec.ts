import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import {
  buildFinalReadingPrompt,
  buildInitialReadingPrompt,
} from "@aethertarot/prompting";
import { describe, expect, it, vi } from "vitest";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  createLlmReadingProviderFromEnv,
  LlmReadingProvider,
  normalizeReadingDraft,
  resolveLlmProviderConfig,
} from "@/server/reading/llm-provider";
import { runReadingGraph } from "@/server/reading/graph";
import {
  buildFollowupAnswers,
  buildHolyTrianglePayload,
} from "@/server/reading/__tests__/fixtures";
import type {
  FinalReadingContext,
  HydratedReadingContext,
} from "@/server/reading/types";

function buildHydratedContext(): HydratedReadingContext {
  const payload = buildHolyTrianglePayload();
  const spread = findSpreadById(payload.spreadId);

  if (!spread) {
    throw new Error("spread not found");
  }

  return {
    question: payload.question,
    questionType: "career",
    agentProfile: payload.agent_profile ?? "standard",
    spread,
    drawnCards: payload.drawnCards.map((item) => {
      const card = findCardById(item.cardId);

      if (!card) {
        throw new Error("card not found");
      }

      return {
        positionId: item.positionId,
        card,
        isReversed: item.isReversed,
      };
    }),
  };
}

async function buildFinalContext(): Promise<FinalReadingContext> {
  const initialReading = await runReadingGraph(buildHolyTrianglePayload());
  const base = buildHydratedContext();

  return {
    ...base,
    initialReading,
    followupAnswers: buildFollowupAnswers(initialReading),
  };
}

describe("llm provider baseline", () => {
  it("builds an initial prompt that includes card-first and authority context requirements", () => {
    const prompt = buildInitialReadingPrompt(buildHydratedContext());

    expect(prompt.system).toMatch(/INITIAL phase/);
    expect(prompt.system).toMatch(/Return JSON only/);
    expect(prompt.system).toMatch(/Simplified Chinese/);
    expect(prompt.system).toMatch(/do not rewrite, translate, paraphrase/i);
    expect(prompt.system).toMatch(/Every card interpretation must be a non-empty Chinese string/);
    expect(prompt.system).toMatch(/Do not fabricate hidden motives, private thoughts, or unverified feelings for any third party/);
    expect(prompt.user).toMatch(/Authority drawn cards/);
    expect(prompt.user).toMatch(/Question: 我该如何看待当前的职业选择/);
    expect(prompt.user).toMatch(/Follow-up questions must be anchored/);
    expect(prompt.user).toMatch(/Follow-up questions must be distinct/);
    expect(prompt.user).toMatch(/Themes should be plain, compact, and insight-bearing/);
    expect(prompt.user).toMatch(/Do not state what the other person secretly feels/);
  });

  it("builds a final prompt that carries initial themes and follow-up answers forward", async () => {
    const prompt = buildFinalReadingPrompt(await buildFinalContext());

    expect(prompt.system).toMatch(/FINAL phase/);
    expect(prompt.system).toMatch(/Simplified Chinese/);
    expect(prompt.user).toMatch(/Initial reading snapshot/);
    expect(prompt.user).toMatch(/Follow-up answers/);
    expect(prompt.user).toMatch(/Preserve the initial primary themes/);
    expect(prompt.user).toMatch(/Keep the synthesis focused on the thematic axis, the clarified tension, and the next grounded reflection/);
    expect(prompt.user).toMatch(/Do not state what the other person secretly feels/);
    expect(prompt.user).toMatch(
      /Do not rewrite the provided card names or position labels/,
    );
  });

  it("rejects missing llm env config", () => {
    expect(() => resolveLlmProviderConfig({})).toThrowError(ReadingServiceError);
    expect(() => createLlmReadingProviderFromEnv({})).toThrowError(
      /AETHERTAROT_LLM_BASE_URL 和 AETHERTAROT_LLM_MODEL/,
    );
  });

  it("normalizes initial llm draft output and trims oversized arrays", () => {
    const context = buildHydratedContext();
    const normalized = normalizeReadingDraft({
      payload: {
        reading_id: "should-be-ignored",
        cards: context.drawnCards.map((drawnCard) => ({
          card_id: drawnCard.card.id,
          position_id: drawnCard.positionId,
          orientation: drawnCard.isReversed ? "reversed" : "upright",
          interpretation: `${drawnCard.card.name} 在这里提示先看清现实节奏。`,
        })),
        themes: ["职业节奏", "现实验证", "边界", "观察", "额外主题"],
        synthesis: "先让牌面建立主轴，再决定如何收束行动。",
        reflective_guidance: [
          "先记录已经出现的现实反馈。",
          "把事实、情绪和推测分开。",
          "优先确认当前最卡住的条件。",
          "给自己一个短周期观察点。",
          "这条会被截断。",
        ],
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
          "接下来两周里，什么现实反馈最能验证这组牌提示的职业节奏？",
          "这条会被截断。",
        ],
        confidence_note: "这是一版需要结合现实继续观察的初读。",
      },
      context,
      phase: "initial",
    });

    expect(normalized.themes).toHaveLength(4);
    expect(normalized.reflective_guidance).toHaveLength(4);
    expect(normalized.follow_up_questions).toHaveLength(2);
    expect(normalized.cards).toHaveLength(context.drawnCards.length);
    expect(normalized.cards[0]?.name).toBe(context.drawnCards[0]?.card.name);
  });

  it("keeps authority display metadata and deduplicates duplicate follow-up questions", () => {
    const context = buildHydratedContext();
    const normalized = normalizeReadingDraft({
      payload: {
        cards: context.drawnCards.map((drawnCard, index) => ({
          card_id: drawnCard.card.id,
          position_id: drawnCard.positionId,
          orientation: drawnCard.isReversed ? "reversed" : "upright",
          name: `乱码-${index}`,
          english_name: `garbled-${index}`,
          position: `错误位置-${index}`,
          position_meaning: `错误含义-${index}`,
          interpretation: `${drawnCard.card.name} 在这里提醒你先回到现实节奏。`,
        })),
        themes: ["职业节奏", "现实验证"],
        synthesis: "先让牌面建立主轴，再决定如何收束行动。",
        reflective_guidance: [
          "先记录已经出现的现实反馈。",
          "把事实、情绪和推测分开。",
        ],
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
        ],
        confidence_note: "这是一版需要结合现实继续观察的初读。",
      },
      context,
      phase: "initial",
    });

    expect(normalized.cards[0]?.name).toBe(context.drawnCards[0]?.card.name);
    expect(normalized.cards[0]?.position).toBe(context.spread.positions[0]?.name);
    expect(normalized.follow_up_questions).toEqual([
      "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
    ]);
  });

  it("normalizes common llm card interpretation aliases into the canonical field", () => {
    const context = buildHydratedContext();
    const normalized = normalizeReadingDraft({
      payload: {
        cards: context.drawnCards.map((drawnCard, index) => ({
          card_id: drawnCard.card.id,
          position_id: drawnCard.positionId,
          orientation: drawnCard.isReversed ? "reversed" : "upright",
          ...(index === 0
            ? {
                card_interpretation:
                  `${drawnCard.card.name} 仍然给出当前位置下的有效解释。`,
              }
            : index === 1
              ? {
                  meaning: [
                    `${drawnCard.card.name} 提醒先看清节奏，`,
                    "再决定下一步。",
                  ],
                }
              : {
                  interpretation: {
                    summary:
                      `${drawnCard.card.name} 在这里指向现实条件的再确认。`,
                  },
                }),
        })),
        themes: ["职业节奏", "现实验证"],
        synthesis: "先让牌面建立主轴，再决定如何收束行动。",
        reflective_guidance: [
          "先记录已经出现的现实反馈。",
          "把事实、情绪和推测分开。",
        ],
        follow_up_questions: [
          "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
        ],
        confidence_note: "这是一版需要结合现实继续观察的初读。",
      },
      context,
      phase: "initial",
    });

    expect(normalized.cards.map((card) => card.interpretation)).toEqual([
      `${context.drawnCards[0]?.card.name} 仍然给出当前位置下的有效解释。`,
      `${context.drawnCards[1]?.card.name} 提醒先看清节奏， 再决定下一步。`,
      `${context.drawnCards[2]?.card.name} 在这里指向现实条件的再确认。`,
    ]);
  });

  it("rejects mismatched authority identity fields in llm draft cards", () => {
    const context = buildHydratedContext();

    expect(() =>
      normalizeReadingDraft({
        payload: {
          cards: context.drawnCards.map((drawnCard, index) => ({
            card_id: index === 0 ? "the-moon" : drawnCard.card.id,
            position_id: drawnCard.positionId,
            orientation: drawnCard.isReversed ? "reversed" : "upright",
            interpretation: `${drawnCard.card.name} 在这里提示先看清现实节奏。`,
          })),
          themes: ["职业节奏", "现实验证"],
          synthesis: "先让牌面建立主轴，再决定如何收束行动。",
          reflective_guidance: [
            "先记录已经出现的现实反馈。",
            "把事实、情绪和推测分开。",
          ],
          follow_up_questions: [
            "这组牌里最卡住行动的位置，对应到现实工作中是哪一类任务、关系或选择？",
          ],
          confidence_note: "这是一版需要结合现实继续观察的初读。",
        },
        context,
        phase: "initial",
      }),
    ).toThrow(/card_id/);
  });

  it("calls an OpenAI-compatible chat completions endpoint and normalizes the final draft", async () => {
    const context = await buildFinalContext();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "```json\n" +
                  JSON.stringify({
                    cards: context.initialReading.cards.map((card) => ({
                      ...card,
                      interpretation: `${card.name} 继续沿着初读主题收束。`,
                    })),
                    themes: [...context.initialReading.themes, "额外主题"],
                    synthesis:
                      "第二阶段会延续初读主题，并结合用户补充缩小解释空间。",
                    reflective_guidance: [
                      "把新增信息拆成事实、感受和推测。",
                      "优先验证最关键的现实条件。",
                      "保留一个低风险的小动作。",
                    ],
                    follow_up_questions: [
                      "经过这次补充后，你最愿意在现实中先验证哪一个小信号？",
                      "这条会被截断。",
                    ],
                    confidence_note: "这仍然是带不确定性的整合深读。",
                    safety_note: "should be ignored",
                  }) +
                  "\n```",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 1800,
      },
      fetchMock as typeof fetch,
    );

    const draft = await provider.generateFinalRead(context);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:11434/v1/chat/completions",
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      max_tokens: 1800,
    });
    expect(draft.themes).toEqual(context.initialReading.themes);
    expect(draft.follow_up_questions).toHaveLength(1);
    expect(draft.reflective_guidance).toHaveLength(3);
  });
});
