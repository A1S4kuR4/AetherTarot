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
  resolveReadingMaxOutputTokens,
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
import type { LlmTokenGate } from "@/server/beta/token-budget";

function buildTokenGate(): LlmTokenGate {
  return {
    reserve: vi.fn(async () => ({ id: "reservation-id", reservedTokens: 4000 })),
    settle: vi.fn(async () => undefined),
  };
}

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
    priorSessionCapsule: null,
    sessionMemory: null,
    knowledgeGrounding: { status: "none", chunks: [] },
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
    expect(prompt.system).toMatch(/provenance belongs only in grounding_claims/);
    expect(prompt.user).toMatch(/Authority drawn cards/);
    expect(prompt.user).toMatch(/Question: 我该如何看待当前的职业选择/);
    expect(prompt.user).toMatch(/Follow-up questions must be anchored/);
    expect(prompt.user).toMatch(/Follow-up questions must be distinct/);
    expect(prompt.user).toMatch(/Themes should be plain, everyday language/);
    expect(prompt.user).toMatch(/place refs only in grounding_claims/);
    expect(prompt.user).not.toMatch(/source_id values inside confidence_note/);
    expect(prompt.user).toMatch(/Do not state what the other person secretly feels/);
  });

  it("forbids invented position journeys in single-card synthesis", () => {
    const context = buildHydratedContext();
    const spread = findSpreadById("single");
    const card = findCardById("temperance");

    if (!spread || !card) {
      throw new Error("single-card prompt fixture is unavailable");
    }

    const prompt = buildInitialReadingPrompt({
      ...context,
      spread,
      drawnCards: [{
        positionId: "focus",
        card,
        isReversed: false,
      }],
    });

    expect(prompt.user).toMatch(/never invent a journey, arc, or from-X-to-X transition/i);
  });

  it("builds a final prompt that carries initial themes and follow-up answers forward", async () => {
    const prompt = buildFinalReadingPrompt(await buildFinalContext());

    expect(prompt.system).toMatch(/FINAL phase/);
    expect(prompt.system).toMatch(/Simplified Chinese/);
    expect(prompt.system).toMatch(/never put source or retrieval metadata here/i);
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

  it("resolves llm api key references from server environment variables", () => {
    expect(
      resolveLlmProviderConfig({
        AETHERTAROT_LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        AETHERTAROT_LLM_MODEL: "qwen3.6-flash",
        AETHERTAROT_LLM_API_KEY: "$DASHSCOPE_API_KEY",
        DASHSCOPE_API_KEY: "sk-test-dashscope",
      }).apiKey,
    ).toBe("sk-test-dashscope");

    expect(
      resolveLlmProviderConfig({
        AETHERTAROT_LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        AETHERTAROT_LLM_MODEL: "qwen3.6-flash",
        AETHERTAROT_LLM_API_KEY: "${DASHSCOPE_API_KEY}",
        DASHSCOPE_API_KEY: "sk-test-braced",
      }).apiKey,
    ).toBe("sk-test-braced");
  });

  it("uses 3200 as the default hard output-token ceiling", () => {
    expect(resolveLlmProviderConfig({
      NODE_ENV: "test",
      AETHERTAROT_LLM_BASE_URL: "https://api.example.com/v1",
      AETHERTAROT_LLM_MODEL: "test-model",
    }).maxOutputTokens).toBe(3200);
  });

  it.each([
    [1, "lite", 900], [1, "standard", 1400], [1, "sober", 1800],
    [3, "lite", 1400], [3, "standard", 1900], [3, "sober", 2300],
    [6, "lite", 1800], [6, "standard", 2400], [6, "sober", 2800],
    [9, "lite", 2200], [9, "standard", 2800], [9, "sober", 3200],
  ] as const)(
    "budgets %i cards in %s mode at %i tokens",
    (cardCount, agentProfile, expected) => {
      expect(resolveReadingMaxOutputTokens({
        agentProfile,
        cardCount,
        configuredMaxOutputTokens: 3200,
      })).toBe(expected);
    },
  );

  it("clamps the profile/card budget to the configured hard ceiling", () => {
    expect(resolveReadingMaxOutputTokens({
      agentProfile: "sober",
      cardCount: 10,
      configuredMaxOutputTokens: 1750,
    })).toBe(1750);
  });

  it("configures provider thinking mode explicitly for models that default to thinking", () => {
    expect(
      resolveLlmProviderConfig({
        AETHERTAROT_LLM_BASE_URL: "https://api.deepseek.com",
        AETHERTAROT_LLM_MODEL: "deepseek-v4-flash",
        AETHERTAROT_LLM_THINKING_MODE: "disabled",
        AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
      }).thinkingMode,
    ).toBe("disabled");

    expect(
      resolveLlmProviderConfig({
        AETHERTAROT_LLM_BASE_URL: "https://api.deepseek.com",
        AETHERTAROT_LLM_MODEL: "deepseek-v4-flash",
        AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
      }).responseFormat,
    ).toBe("json_object");

    expect(() =>
      resolveLlmProviderConfig({
        AETHERTAROT_LLM_BASE_URL: "https://api.deepseek.com",
        AETHERTAROT_LLM_MODEL: "deepseek-v4-flash",
        AETHERTAROT_LLM_THINKING_MODE: "sometimes",
      }),
    ).toThrow(/AETHERTAROT_LLM_THINKING_MODE/);
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
    const tokenGate = buildTokenGate();
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      void _input;
      void _init;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "```json\n" +
                  JSON.stringify({
                    cards: context.initialReading.cards.map((card) => ({
                      ...card,
                      interpretation: `${card.name} 结合你的补充，让原有主题更贴近现实。`,
                    })),
                    themes: [...context.initialReading.themes, "额外主题"],
                    synthesis:
                      "你补充的信息让原有主题更具体，也缩小了仍待验证的范围。",
                    reflective_guidance: [
                      "把新增信息拆成事实、感受和推测。",
                      "优先验证最关键的现实条件。",
                      "保留一个低风险的小动作。",
                    ],
                    follow_up_questions: [
                      "经过这次补充后，你最愿意在现实中先验证哪一个小信号？",
                      "这条会被截断。",
                    ],
                    confidence_note: "这些线索仍需要结合现实信息继续验证。",
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
      );
    });

    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        thinkingMode: "disabled",
        responseFormat: "json_object",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 3200,
      },
      fetchMock as typeof fetch,
      tokenGate,
    );

    const draft = await provider.generateFinalRead(context);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:11434/v1/chat/completions",
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 1900,
    });
    expect(tokenGate.reserve).toHaveBeenCalledWith(expect.objectContaining({
      source: "reading",
      maxOutputTokens: 1900,
    }));
    expect(draft.themes).toEqual(context.initialReading.themes);
    expect(draft.follow_up_questions).toHaveLength(1);
    expect(draft.reflective_guidance).toHaveLength(3);
  });

  it("returns the complete staged payload when contract validation requests repair", async () => {
    const context = await buildFinalContext();
    const tokenGate = buildTokenGate();
    const completion = {
      themes: context.initialReading.themes,
      synthesis: "这段综合保留了初读主轴，只需要修复一个字段。",
      reflective_guidance: [
        "先核实补充信息对应的现实信号。",
        "保留一个低风险的小动作。",
      ],
      follow_up_questions: "这个字段错误地使用了字符串。",
      confidence_note: "这些线索仍需要结合现实信息继续验证。",
    };
    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        thinkingMode: "disabled",
        responseFormat: "json_object",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 3200,
      },
      vi.fn(async () => Response.json({
        choices: [{
          finish_reason: "stop",
          message: { content: JSON.stringify(completion) },
        }],
      })) as typeof fetch,
      tokenGate,
    );

    await expect(provider.refineFinalSynthesis(context, {
      runId: "run-final-repair",
      stageId: "run-final-repair:final_synthesis",
      attemptId: "run-final-repair:final_synthesis:1",
      stage: "final_synthesis",
      attempt: 1,
      kind: "generate",
    })).rejects.toMatchObject({
      subtype: "schema_violation",
      invalidPayload: completion,
    });
    expect(tokenGate.settle).toHaveBeenCalledTimes(1);
  });

  it("does not call the model when the daily token reservation is rejected", async () => {
    const context = await buildFinalContext();
    const fetchMock = vi.fn();
    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 1800,
      },
      fetchMock as typeof fetch,
      {
        reserve: vi.fn(async () => {
          throw new ReadingServiceError(
            "token_limit_exceeded",
            "今日体验额度已用完，请于明日再试。",
            429,
          );
        }),
        settle: vi.fn(async () => undefined),
      },
    );

    await expect(provider.generateFinalRead(context)).rejects.toMatchObject({
      code: "token_limit_exceeded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("settles the full reservation after a failed external request", async () => {
    const context = await buildFinalContext();
    const tokenGate = buildTokenGate();
    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 1800,
      },
      vi.fn(async () => {
        throw new Error("network down");
      }) as typeof fetch,
      tokenGate,
    );

    await expect(provider.generateFinalRead(context)).rejects.toMatchObject({
      code: "provider_unavailable",
    });
    expect(tokenGate.settle).toHaveBeenCalledWith({
      reservation: { id: "reservation-id", reservedTokens: 4000 },
      actualTokens: undefined,
    });
  });

  it("reports provider length truncation distinctly and settles actual usage", async () => {
    const context = await buildFinalContext();
    const tokenGate = buildTokenGate();
    const provider = new LlmReadingProvider(
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "test-model",
        temperature: 0.2,
        timeoutMs: 5_000,
        maxOutputTokens: 3200,
      },
      vi.fn(async () => new Response(JSON.stringify({
        choices: [{
          finish_reason: "length",
          message: { content: '{"cards":[' },
        }],
        usage: {
          prompt_tokens: 600,
          completion_tokens: 1900,
          total_tokens: 2500,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
      tokenGate,
    );

    await expect(provider.generateFinalRead(context)).rejects.toMatchObject({
      code: "generation_failed",
      message: expect.stringMatching(/长度上限.*未完整生成/),
    });
    expect(tokenGate.reserve).toHaveBeenCalledWith(expect.objectContaining({
      maxOutputTokens: 1900,
    }));
    expect(tokenGate.settle).toHaveBeenCalledWith({
      reservation: { id: "reservation-id", reservedTokens: 4000 },
      actualTokens: 2500,
    });
  });
});
