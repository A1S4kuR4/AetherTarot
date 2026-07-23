import { describe, expect, it } from "vitest";
import { runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import { createInMemorySessionMemoryStore } from "@/server/reading/memory";
import {
  buildSinglePayload,
  TestReadingProvider,
} from "@/server/reading/__tests__/fixtures";

describe("reading generated-content safety", () => {
  it("replaces severe provider output before capsule and thread memory writes", async () => {
    const memoryStore = createInMemorySessionMemoryStore();
    const unsafeText = "你应该停药。";
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

    expect(visibleReading).not.toContain(unsafeText);
    expect(result.reading.safety_note).toMatch(/替换/);
    expect(result.reading.session_capsule).toBeTruthy();
    expect(result.reading.session_capsule).not.toContain(unsafeText);
    expect(JSON.stringify(memory)).not.toContain(unsafeText);
    expect(JSON.stringify(result.agentState)).not.toContain(unsafeText);
    expect(JSON.stringify(result.trace)).not.toContain(unsafeText);
    expect(result.reading.grounding?.status).toBe("degraded");
    expect(result.reading.grounding?.sources.every(
      (source) => source.kind === "authority_card",
    )).toBe(true);
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
