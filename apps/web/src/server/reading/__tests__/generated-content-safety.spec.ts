import { describe, expect, it } from "vitest";
import { runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import { PlaceholderReadingProvider } from "@/server/reading/provider";
import {
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";

describe("reading generated-content safety", () => {
  it("still degrades deterministic staged claims after a safety rewrite", async () => {
    const unsafeText = "你应该停药。";
    class UnsafeCompactProvider extends PlaceholderReadingProvider {
      override async generateCompactRead() {
        return {
          card_insights: [{
            index: 0,
            interpretation: "这张牌先提供一条安全的现实观察。",
          }],
          synthesis: {
            themes: ["现实观察", "谨慎判断"],
            synthesis: unsafeText,
            reflective_guidance: ["核实现实信息。", "必要时咨询专业人士。"],
            follow_up_questions: [],
            confidence_note: "这只是反思线索。",
          },
        };
      }
    }
    const result = await runReadingGraphWithDiagnostics(
      { ...buildSinglePayload(), agent_profile: "lite" },
      {
        provider: new UnsafeCompactProvider(),
        generationMode: "adaptive_staged",
      },
    );

    expect(JSON.stringify(result.reading)).not.toContain(unsafeText);
    expect(result.reading.safety_note).toMatch(/替换/);
    expect(result.reading.grounding?.status).toBe("degraded");
    expect(result.reading.grounding?.sources.every(
      (source) => source.kind === "authority_card",
    )).toBe(true);
  });

  it("replaces severe provider output before capsule and thread memory writes", async () => {
    const memoryStore = createInMemorySessionMemoryStore();
    const unsafeText = "You should stop taking antidepressants";
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我该如何理解现在的状态？"),
        agent_profile: "lite",
        thread_id: "safety-output-thread",
      },
      {
        provider: new TestReadingProvider({
          initial: (draft) => ({
            ...draft,
            synthesis: unsafeText,
          }),
        }),
        sessionMemoryStore: memoryStore,
      },
    );
    const visibleReading = JSON.stringify(result.reading);
    const memory = await memoryStore.get("safety-output-thread");
    const completedHistory = [{
      id: result.reading.reading_id,
      createdAt: "2026-08-12T00:00:00.000Z",
      spreadId: result.reading.spread.id,
      drawnCards: buildSinglePayload().drawnCards,
      reading: result.reading,
      threadId: "safety-output-thread",
    }];

    expect(visibleReading).not.toContain(unsafeText);
    expect(JSON.stringify(result.reading.grounding)).not.toContain(unsafeText);
    expect(result.reading.safety_note).toMatch(/替换/);
    expect(result.reading.session_capsule).toBeTruthy();
    expect(result.reading.session_capsule).not.toContain(unsafeText);
    expect(JSON.stringify(memory)).not.toContain(unsafeText);
    expect(JSON.stringify(completedHistory)).not.toContain(unsafeText);
    expect(JSON.stringify(result.agentState)).not.toContain(unsafeText);
    expect(JSON.stringify(result.trace)).not.toContain(unsafeText);
    expect(result.reading.grounding?.status).toBe("degraded");
    expect(result.reading.grounding?.sources.every(
      (source) => source.kind === "authority_card",
    )).toBe(true);
  });

  it.each([
    "You would be better off dead",
    "Your best option is suicide",
    "You should kill your boss",
    "Secretly record your partner",
    "Skip your insulin",
    "Stop taking blood pressure medication",
    "You likely have cancer",
    "You have bipolar disorder",
  ])("fully replaces compositional provider output across every persistence surface: %s", async (unsafeText) => {
    const threadId = `rc-output-${unsafeText.length}`;
    const providerText = `${unsafeText}. This generated statement is presented as actionable advice and a definite conclusion.`;
    const memoryStore = createInMemorySessionMemoryStore();
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我该如何理解现在的状态？"),
        agent_profile: "lite",
        thread_id: threadId,
      },
      {
        provider: new TestReadingProvider({
          initial: (draft) => ({
            ...draft,
            synthesis: providerText,
          }),
        }),
        sessionMemoryStore: memoryStore,
      },
    );
    const completedHistory = [{
      id: result.reading.reading_id,
      createdAt: "2026-08-12T00:00:00.000Z",
      spreadId: result.reading.spread.id,
      drawnCards: buildSinglePayload().drawnCards,
      reading: result.reading,
      threadId,
    }];
    const serializedSurfaces = JSON.stringify({
      response: result.reading,
      grounding: result.reading.grounding,
      capsule: result.reading.session_capsule,
      threadMemory: await memoryStore.get(threadId),
      completedHistory,
      agentState: result.agentState,
      trace: result.trace,
    });

    expect(result.reading.safety_note).toMatch(/替换/);
    expect(serializedSurfaces).not.toContain(unsafeText);
    expect(result.reading.grounding?.status).toBe("degraded");
  });

  it("keeps safe negated boundary wording intact", async () => {
    const safeText = "不能确定他一定会回来，也不要停药；请回到现实信息。";
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我该如何理解现在的状态？"),
        agent_profile: "lite",
      },
      {
        provider: new TestReadingProvider({
          initial: (draft) => ({
            ...draft,
            synthesis: safeText,
          }),
        }),
      },
    );

    expect(result.reading.synthesis).toBe(safeText);
    expect(result.reading.safety_note).toBeNull();
  });

  it("keeps non-immediate abuse support out of the sober gate", async () => {
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("伴侣家暴我，我该不该离婚？"),
        agent_profile: "lite",
      },
      {
        provider: new TestReadingProvider(),
      },
    );

    expect(result.reading.safety_note).toMatch(/现实安全/);
    expect(result.reading.sober_check).toBeNull();
    expect(result.reading.presentation_mode).toBe("standard");
    expect(result.reading.follow_up_questions).toEqual([
      "为了让自己更安全，你现在最需要联系谁或确认哪项现实支持？",
    ]);
  });

  it.each([
    "I am being stalked by my ex and need safety help",
    "My partner monitors my phone and I need help",
  ])("keeps English monitoring-victim help on bounded abuse support: %s", async (question) => {
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload(question),
        agent_profile: "lite",
      },
      {
        provider: new TestReadingProvider(),
      },
    );

    expect(result.reading.safety_note).toMatch(/现实安全/);
    expect(result.reading.sober_check).toBeNull();
    expect(result.reading.presentation_mode).toBe("standard");
  });

  it("keeps all-savings investment outsourcing on the sober gate", async () => {
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("Should I invest all my savings?"),
        agent_profile: "lite",
      },
      {
        provider: new TestReadingProvider(),
      },
    );

    expect(result.reading.sober_check).toBeTruthy();
    expect(result.reading.presentation_mode).toBe("sober_anchor");
  });

  it("leaves ordinary relationship conflict on the standard path", async () => {
    const result = await runReadingGraphWithDiagnostics(
      {
        ...buildSinglePayload("我们总吵架，沟通很困难，我该如何理解？"),
        agent_profile: "lite",
      },
      {
        provider: new TestReadingProvider(),
      },
    );

    expect(result.reading.safety_note).toBeNull();
    expect(result.reading.sober_check).toBeNull();
    expect(result.reading.presentation_mode).toBe("standard");
  });
});
