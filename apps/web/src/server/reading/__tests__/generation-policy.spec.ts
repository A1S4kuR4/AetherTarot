import { describe, expect, it } from "vitest";
import {
  ReadingGenerationError,
  ReadingServiceError,
} from "@/server/reading/errors";
import {
  buildReadingGenerationPlan,
} from "@/server/reading/generation-policy";
import {
  runReadingGraphWithDiagnostics,
} from "@/server/reading/graph";
import {
  PlaceholderReadingProvider,
} from "@/server/reading/provider";
import {
  createInMemorySessionMemoryStore,
} from "@/server/reading/memory";
import type {
  HydratedReadingContext,
  ReadingGenerationCallOptions,
  RepairStageRequest,
} from "@/server/reading/types";
import {
  buildFollowupAnswers,
  buildHolyTrianglePayload,
  buildSevenCardPayload,
  buildSinglePayload,
} from "@/server/reading/__tests__/fixtures";

class RecordingProvider extends PlaceholderReadingProvider {
  stages: string[] = [];

  override async generateCompactRead(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ) {
    this.stages.push(`compact:${options.attempt}:${options.kind}`);
    return super.generateCompactRead(context, options);
  }

  override async generateCardInsights(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ) {
    this.stages.push(`card_insights:${options.attempt}:${options.kind}`);
    return super.generateCardInsights(context, options);
  }

  override async generateSynthesis(
    context: HydratedReadingContext,
    cardInsights: Parameters<PlaceholderReadingProvider["generateSynthesis"]>[1],
    options: ReadingGenerationCallOptions,
  ) {
    this.stages.push(`synthesis:${options.attempt}:${options.kind}`);
    return super.generateSynthesis(context, cardInsights, options);
  }

  override async refineFinalSynthesis(
    context: Parameters<PlaceholderReadingProvider["refineFinalSynthesis"]>[0],
    options: ReadingGenerationCallOptions,
  ) {
    this.stages.push(`final_synthesis:${options.attempt}:${options.kind}`);
    return super.refineFinalSynthesis(context, options);
  }
}

describe("adaptive staged reading generation", () => {
  it("routes Lite 1-4 card Initial through one compact stage", async () => {
    const provider = new RecordingProvider();
    const result = await runReadingGraphWithDiagnostics(
      { ...buildSinglePayload(), agent_profile: "lite" },
      { provider, generationMode: "adaptive_staged" },
    );

    expect(provider.stages).toEqual(["compact:1:generate"]);
    expect(result.reading.cards).toHaveLength(1);
    expect(result.trace.generation).toMatchObject({
      mode: "adaptive_staged",
      stages: ["compact"],
      max_requests: 2,
    });
  });

  it("routes Standard Initial through card insights then synthesis", async () => {
    const provider = new RecordingProvider();
    const result = await runReadingGraphWithDiagnostics(
      { ...buildHolyTrianglePayload(), agent_profile: "standard" },
      { provider, generationMode: "adaptive_staged" },
    );

    expect(provider.stages).toEqual([
      "card_insights:1:generate",
      "synthesis:1:generate",
    ]);
    expect(result.reading.cards.map((card) => card.position_id)).toEqual([
      "past",
      "present",
      "future",
    ]);
  });

  it("preserves verified staged prose when the provider omits optional refs", async () => {
    const cardPrefix = "staged-card-prose";
    const synthesisText = "staged-synthesis-prose：整组牌要求先核对现实条件，再选择低风险行动。";
    class ContentProvider extends RecordingProvider {
      override async generateCardInsights(
        context: HydratedReadingContext,
        options: ReadingGenerationCallOptions,
      ) {
        this.stages.push(`card_insights:${options.attempt}:${options.kind}`);
        return context.drawnCards.map((_, index) => ({
          index,
          interpretation: `${cardPrefix}-${index}：这个位置提供一条可核实的观察线索。`,
        }));
      }

      override async generateSynthesis(
        _context: HydratedReadingContext,
        _cardInsights: Parameters<PlaceholderReadingProvider["generateSynthesis"]>[1],
        options: ReadingGenerationCallOptions,
      ) {
        this.stages.push(`synthesis:${options.attempt}:${options.kind}`);
        return {
          themes: ["核实现实条件", "选择低风险行动"],
          synthesis: synthesisText,
          reflective_guidance: [
            "列出已经确认的事实。",
            "标记仍待验证的假设。",
            "选择一个可撤回的小步骤。",
          ],
          follow_up_questions: ["哪个现实条件最需要先确认？"],
          confidence_note: "这些内容是反思线索，不替代现实判断。",
        };
      }
    }

    const result = await runReadingGraphWithDiagnostics(
      { ...buildHolyTrianglePayload(), agent_profile: "standard" },
      { provider: new ContentProvider(), generationMode: "adaptive_staged" },
    );

    expect(result.reading.cards.map((card) => card.interpretation)).toEqual([
      `${cardPrefix}-0：这个位置提供一条可核实的观察线索。`,
      `${cardPrefix}-1：这个位置提供一条可核实的观察线索。`,
      `${cardPrefix}-2：这个位置提供一条可核实的观察线索。`,
    ]);
    expect(result.reading.synthesis).toBe(synthesisText);
    expect(result.reading.grounding?.status).toBe("grounded");
  });

  it("keeps seven-card Initial in one card-insight batch", () => {
    expect(buildReadingGenerationPlan({
      mode: "adaptive_staged",
      phase: "initial",
      agentProfile: "lite",
      cardCount: buildSevenCardPayload().drawnCards.length,
    })).toEqual({
      mode: "adaptive_staged",
      stages: ["card_insights", "synthesis"],
      max_requests: 4,
    });
  });

  it("reuses Initial cards in Final synthesis refinement", async () => {
    const initial = await runReadingGraphWithDiagnostics(
      { ...buildHolyTrianglePayload(), agent_profile: "standard" },
      { provider: new PlaceholderReadingProvider(), generationMode: "monolithic" },
    );
    const provider = new RecordingProvider();
    const final = await runReadingGraphWithDiagnostics(
      {
        ...buildHolyTrianglePayload(),
        agent_profile: "standard",
        phase: "final",
        initial_reading_id: initial.reading.reading_id,
        followup_answers: buildFollowupAnswers(initial.reading),
      },
      {
        provider,
        generationMode: "adaptive_staged",
        initialReading: initial.reading,
      },
    );

    expect(provider.stages).toEqual(["final_synthesis:1:generate"]);
    expect(final.reading.cards).toEqual(initial.reading.cards);
    expect(final.reading.themes).toEqual(initial.reading.themes);
  });

  it("uses constrained repair once for a contract failure", async () => {
    class RepairingProvider extends RecordingProvider {
      override async generateCardInsights(
        _context: HydratedReadingContext,
        options: ReadingGenerationCallOptions,
      ): Promise<never> {
        this.stages.push(`card_insights:${options.attempt}:${options.kind}`);
        throw new ReadingGenerationError({
          subtype: "schema_violation",
          stage: "card_insights",
          message: "bad card insights",
          retryable: true,
          invalidPayload: { card_insights: [] },
          issues: ["card count mismatch"],
        });
      }

      override async repairStage(
        request: RepairStageRequest,
        options: ReadingGenerationCallOptions,
      ) {
        this.stages.push(`${request.stage}:${options.attempt}:${options.kind}`);
        return PlaceholderReadingProvider.prototype.generateCardInsights.call(
          this,
          request.context,
          options,
        );
      }
    }

    const provider = new RepairingProvider();
    const result = await runReadingGraphWithDiagnostics(
      { ...buildHolyTrianglePayload(), agent_profile: "standard" },
      { provider, generationMode: "adaptive_staged" },
    );

    expect(provider.stages.slice(0, 2)).toEqual([
      "card_insights:1:generate",
      "card_insights:2:repair",
    ]);
    expect(result.trace.generation?.attempts[1]).toMatchObject({
      stage: "card_insights",
      attempt: 2,
      kind: "repair",
      success: true,
    });
  });

  it("does not retry cancellation or persist failed intermediate state", async () => {
    class CancelledProvider extends RecordingProvider {
      override async generateCompactRead(
        _context: HydratedReadingContext,
        options: ReadingGenerationCallOptions,
      ): Promise<never> {
        this.stages.push(`compact:${options.attempt}:${options.kind}`);
        throw new ReadingGenerationError({
          subtype: "cancelled",
          stage: "compact",
          message: "cancelled",
          retryable: false,
        });
      }
    }

    const provider = new CancelledProvider();
    const memory = createInMemorySessionMemoryStore();
    await expect(runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload(),
        agent_profile: "lite",
        thread_id: "cancelled-thread",
      },
      {
        provider,
        generationMode: "adaptive_staged",
        sessionMemoryStore: memory,
        memoryUserId: "test-user",
      },
    )).rejects.toMatchObject({
      subtype: "cancelled",
      diagnosticTrace: {
        generation: {
          failure_stage: "compact",
          failure_subtype: "cancelled",
        },
      },
    });
    expect(provider.stages).toEqual(["compact:1:generate"]);
    expect(await memory.get({
      userId: "test-user",
      threadId: "cancelled-thread",
    })).toBeNull();
  });

  it("does not retry a token refusal after a completed first stage", async () => {
    class TokenRefusedProvider extends RecordingProvider {
      override async generateSynthesis(
        _context: HydratedReadingContext,
        _cardInsights: Parameters<PlaceholderReadingProvider["generateSynthesis"]>[1],
        options: ReadingGenerationCallOptions,
      ): Promise<never> {
        this.stages.push(`synthesis:${options.attempt}:${options.kind}`);
        throw new ReadingServiceError(
          "token_limit_exceeded",
          "token budget refused stage 2",
          429,
        );
      }
    }

    const provider = new TokenRefusedProvider();
    await expect(runReadingGraphWithDiagnostics(
      { ...buildHolyTrianglePayload(), agent_profile: "standard" },
      { provider, generationMode: "adaptive_staged" },
    )).rejects.toMatchObject({
      code: "token_limit_exceeded",
      message: "token budget refused stage 2",
    });
    expect(provider.stages).toEqual([
      "card_insights:1:generate",
      "synthesis:1:generate",
    ]);
  });

  it.each(["queue_full", "queue_timeout"] as const)(
    "does not stage-retry a %s provider rejection",
    async (subtype) => {
      class QueueRejectedProvider extends RecordingProvider {
        override async generateCompactRead(
          _context: HydratedReadingContext,
          options: ReadingGenerationCallOptions,
        ): Promise<never> {
          this.stages.push(`compact:${options.attempt}:${options.kind}`);
          throw new ReadingGenerationError({
            subtype,
            stage: "compact",
            message: subtype,
            retryable: true,
          });
        }
      }

      const provider = new QueueRejectedProvider();
      await expect(runReadingGraphWithDiagnostics(
        { ...buildSinglePayload(), agent_profile: "lite" },
        { provider, generationMode: "adaptive_staged" },
      )).rejects.toMatchObject({ subtype });
      expect(provider.stages).toEqual(["compact:1:generate"]);
    },
  );

  it("marks the second failed attempt as retry_exhausted", async () => {
    class ExhaustedProvider extends RecordingProvider {
      override async generateCompactRead(): Promise<never> {
        throw new ReadingGenerationError({
          subtype: "malformed_json",
          stage: "compact",
          message: "invalid json",
          retryable: true,
          invalidPayload: "{",
        });
      }

      override async repairStage(): Promise<never> {
        throw new ReadingGenerationError({
          subtype: "schema_violation",
          stage: "compact",
          message: "still invalid",
          retryable: true,
        });
      }
    }

    await expect(runReadingGraphWithDiagnostics(
      { ...buildSinglePayload(), agent_profile: "lite" },
      {
        provider: new ExhaustedProvider(),
        generationMode: "adaptive_staged",
      },
    )).rejects.toMatchObject({
      subtype: "retry_exhausted",
      retryCauseSubtype: "schema_violation",
      diagnosticTrace: {
        generation: {
          failure_stage: "compact",
          failure_subtype: "retry_exhausted",
          attempts: [
            { attempt: 1, kind: "generate", success: false },
            { attempt: 2, kind: "repair", success: false },
          ],
        },
      },
    });
  });
});
