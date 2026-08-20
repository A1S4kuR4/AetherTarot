import { describe, expect, it, vi } from "vitest";
import { assessSafetyFields } from "@/server/safety/policy";
import {
  LLMSafetyReviewer,
  inputSafetyReviewVerdictSchema,
  mergeInputSafetyAssessment,
  outputSafetyReviewVerdictSchema,
  resolveSafetyReviewerConfig,
  validateSafetyOutputReviewVerdict,
  type SafetyReviewerMetric,
  type SafetyReviewerProvider,
} from "@/server/safety/llm-reviewer";
import { mergeGeneratedContentAction } from "@/server/safety/output-validator";
import type { SafetyReviewerSubjectGate } from "@/server/beta/token-budget";

const inputPass = {
  level: "standard" as const,
  categories: [],
  referral_kind: "none" as const,
  policy_version: "safety-reviewer-v1",
  model_version: "reviewer-test",
};

const outputPass = {
  action: "pass" as const,
  violations: [],
  flagged_paths: [],
  policy_version: "safety-reviewer-v1",
  model_version: "reviewer-test",
};

function buildProvider(overrides: Partial<SafetyReviewerProvider> = {}): SafetyReviewerProvider {
  return {
    reviewInput: vi.fn(async () => inputPass),
    reviewOutput: vi.fn(async () => outputPass),
    ...overrides,
  };
}

function buildReviewer({
  mode = "enforce",
  provider = buildProvider(),
  metrics = [],
  rateLimitPerMinute = 100,
  subjectRateLimitPerMinute = 12,
  subjectGate = { consume: vi.fn(async () => undefined) },
}: {
  mode?: "off" | "shadow" | "enforce";
  provider?: SafetyReviewerProvider;
  metrics?: SafetyReviewerMetric[];
  rateLimitPerMinute?: number;
  subjectRateLimitPerMinute?: number;
  subjectGate?: SafetyReviewerSubjectGate;
} = {}) {
  return new LLMSafetyReviewer({
    config: {
      mode,
      policyVersion: "safety-reviewer-v1",
      model: "reviewer-test",
      cacheTtlMs: 30_000,
      cacheHmacSecret: "reviewer-test-secret-that-is-long-enough",
      rateLimitPerMinute,
      subjectRateLimitPerMinute,
      circuitFailureThreshold: 2,
      circuitResetMs: 30_000,
    },
    provider,
    subjectGate,
    recordMetric: (metric) => metrics.push(metric),
  });
}

describe("LLM safety reviewer contracts", () => {
  it("strictly rejects free-text rationale and user-visible wording", () => {
    expect(() => inputSafetyReviewVerdictSchema({
      policyVersion: "safety-reviewer-v1",
      modelVersion: "reviewer-test",
    }).parse({ ...inputPass, rationale: "because" })).toThrow();
    expect(() => outputSafetyReviewVerdictSchema({
      policyVersion: "safety-reviewer-v1",
      modelVersion: "reviewer-test",
    }).parse({ ...outputPass, replacement_text: "unsafe" })).toThrow();
  });

  it("rejects unknown versions and arbitrary flagged paths", () => {
    const schema = outputSafetyReviewVerdictSchema({
      policyVersion: "safety-reviewer-v1",
      modelVersion: "reviewer-test",
    });
    expect(() => schema.parse({ ...outputPass, model_version: "other-model" })).toThrow();
    expect(() => schema.parse({ ...outputPass, flagged_paths: ["session_capsule"] })).toThrow();
  });

  it("requires coherent output verdicts and upgrades severe violations to replace", () => {
    const availablePaths = new Set(["synthesis"]);

    expect(() => validateSafetyOutputReviewVerdict({
      ...outputPass,
      violations: ["deterministic_claim"],
    }, availablePaths)).toThrow(/pass/);
    expect(() => validateSafetyOutputReviewVerdict({
      ...outputPass,
      action: "restrict",
      violations: ["deterministic_claim"],
      flagged_paths: [],
    }, availablePaths)).toThrow(/非 pass/);
    expect(() => validateSafetyOutputReviewVerdict({
      ...outputPass,
      action: "restrict",
      violations: ["deterministic_claim"],
      flagged_paths: ["themes.0"],
    }, availablePaths)).toThrow(/实际输出字段/);
    expect(validateSafetyOutputReviewVerdict({
      ...outputPass,
      action: "restrict",
      violations: ["medical_diagnosis"],
      flagged_paths: ["synthesis"],
    }, availablePaths).action).toBe("replace");
  });
});

describe("LLM safety reviewer upper-bound merge", () => {
  it("never lowers deterministic hard-stop, bounded abuse support, or sober-check", () => {
    const hardStop = assessSafetyFields(["我想自杀"]);
    const abuse = assessSafetyFields(["伴侣家暴我，我需要帮助"]);
    const sober = assessSafetyFields(["我该不该离婚？"]);

    expect(mergeInputSafetyAssessment(hardStop, inputPass).level).toBe("hard_stop");
    expect(mergeInputSafetyAssessment(abuse, inputPass)).toMatchObject({
      level: "bounded",
      primaryCategory: "abuse_support",
    });
    expect(mergeInputSafetyAssessment(sober, inputPass).level).toBe("sober_check");
  });

  it("lets a reviewer upgrade standard input to a fixed hard-stop", () => {
    const merged = mergeInputSafetyAssessment(assessSafetyFields(["普通问题"]), {
      ...inputPass,
      level: "hard_stop",
      categories: ["self_harm"],
      referral_kind: "crisis",
    });

    expect(merged.level).toBe("hard_stop");
    expect(merged.userMessage).toMatch(/现实支持/);
    expect(merged.referralLinks?.every((link) => link.startsWith("https://"))).toBe(true);
  });

  it("does not let sober-check overwrite deterministic abuse support", () => {
    const merged = mergeInputSafetyAssessment(
      assessSafetyFields(["伴侣家暴我，我需要帮助"]),
      { ...inputPass, level: "sober_check", categories: ["major_decision"] },
    );
    expect(merged).toMatchObject({ level: "bounded", primaryCategory: "abuse_support" });
  });

  it("never lets output review lower deterministic restrict or replace", () => {
    expect(mergeGeneratedContentAction("restrict", "pass")).toBe("restrict");
    expect(mergeGeneratedContentAction("replace", "pass")).toBe("replace");
    expect(mergeGeneratedContentAction("replace", "restrict")).toBe("replace");
    expect(mergeGeneratedContentAction("pass", "replace")).toBe("replace");
  });
});

describe("LLM safety reviewer failure and privacy semantics", () => {
  it("rate-limits each subject independently without putting the key in reviewer payloads", async () => {
    const provider = buildProvider();
    const reviewer = buildReviewer({ provider, rateLimitPerMinute: 1 });

    await reviewer.reviewInput({
      requestId: "subject-a-1",
      question: "问题一",
      followupAnswers: [],
      subjectKey: "hashed-subject-a",
    });
    await expect(reviewer.reviewInput({
      requestId: "subject-a-2",
      question: "问题二",
      followupAnswers: [],
      subjectKey: "hashed-subject-a",
    })).rejects.toMatchObject({ code: "provider_unavailable", status: 503 });
    await reviewer.reviewInput({
      requestId: "subject-b-1",
      question: "问题三",
      followupAnswers: [],
      subjectKey: "hashed-subject-b",
    });

    expect(JSON.stringify(vi.mocked(provider.reviewInput).mock.calls)).not.toContain("hashed-subject");
  });

  it("enforces a shared subject gate across reviewer instances before either provider call", async () => {
    const seenKeys: string[] = [];
    const sharedGate: SafetyReviewerSubjectGate = {
      consume: vi.fn(async ({ subjectKey }) => {
        seenKeys.push(subjectKey);
        if (seenKeys.length > 1) throw new Error("subject_limit");
      }),
    };
    const firstProvider = buildProvider();
    const secondProvider = buildProvider();
    const first = buildReviewer({ provider: firstProvider, subjectGate: sharedGate });
    const second = buildReviewer({ provider: secondProvider, subjectGate: sharedGate });

    await first.reviewInput({ requestId: "instance-a", question: "问题一", followupAnswers: [], subjectKey: "user:42" });
    await expect(second.reviewInput({ requestId: "instance-b", question: "问题二", followupAnswers: [], subjectKey: "user:42" }))
      .rejects.toMatchObject({ code: "provider_unavailable", status: 503 });

    expect(firstProvider.reviewInput).toHaveBeenCalledTimes(1);
    expect(secondProvider.reviewInput).not.toHaveBeenCalled();
    expect(seenKeys).toHaveLength(2);
    expect(seenKeys.every((key) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
    expect(JSON.stringify(vi.mocked(firstProvider.reviewInput).mock.calls)).not.toContain("user:42");
  });

  it("keeps a subject-gate failure non-enforcing in shadow mode", async () => {
    const provider = buildProvider();
    const reviewer = buildReviewer({
      mode: "shadow",
      provider,
      subjectGate: { consume: vi.fn(async () => { throw new Error("subject_limit"); }) },
    });

    const result = await reviewer.reviewInput({
      requestId: "shadow-subject-limit",
      question: "普通问题",
      followupAnswers: [],
      subjectKey: "ip:hash",
    });

    expect(result).toMatchObject({ mode: "shadow", applied: false, verdict: { level: "standard" } });
    expect(provider.reviewInput).not.toHaveBeenCalled();
  });

  it.each(["timeout", "schema_error", "circuit_open"])(
    "fails closed as provider_unavailable in enforce mode: %s",
    async (kind) => {
      const provider = buildProvider({
        reviewInput: vi.fn(async () => {
          throw new Error(kind);
        }),
      });
      const reviewer = buildReviewer({ provider });
      if (kind === "circuit_open") {
        await expect(reviewer.reviewInput({ requestId: "r1", question: "q", followupAnswers: [] }))
          .rejects.toMatchObject({ code: "provider_unavailable", status: 503 });
      }
      await expect(reviewer.reviewInput({ requestId: `r-${kind}`, question: "q", followupAnswers: [] }))
        .rejects.toMatchObject({ code: "provider_unavailable", status: 503 });
    },
  );

  it("keeps shadow verdicts non-enforcing while emitting raw-free metrics", async () => {
    const metrics: SafetyReviewerMetric[] = [];
    const secret = "private raw question that must not be logged";
    const reviewer = buildReviewer({
      mode: "shadow",
      metrics,
      provider: buildProvider({
        reviewInput: vi.fn(async () => ({
          ...inputPass,
          level: "hard_stop" as const,
          categories: ["self_harm" as const],
          referral_kind: "crisis" as const,
        })),
      }),
    });

    const result = await reviewer.reviewInput({ requestId: "shadow-1", question: secret, followupAnswers: [] });
    expect(result.applied).toBe(false);
    expect(result.verdict.level).toBe("hard_stop");
    expect(JSON.stringify(metrics)).not.toContain(secret);
    expect(metrics[0]).toMatchObject({ purpose: "safety_input", decision: "hard_stop" });
  });

  it("uses request-id HMAC verdict caching without a second provider charge", async () => {
    const provider = buildProvider();
    const reviewer = buildReviewer({ provider });
    const input = { requestId: "same-request", question: "同一个问题", followupAnswers: ["同一回答"] };

    const first = await reviewer.reviewInput(input);
    const second = await reviewer.reviewInput(input);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(provider.reviewInput).toHaveBeenCalledTimes(1);
  });

  it("sends only question and answer fields to input review", async () => {
    const provider = buildProvider();
    const reviewer = buildReviewer({ provider });
    await reviewer.reviewInput({ requestId: "minimal", question: "问题", followupAnswers: ["回答一"] });

    const serialized = JSON.stringify(vi.mocked(provider.reviewInput).mock.calls[0]?.[0]);
    expect(serialized).toContain("问题");
    expect(serialized).toContain("回答一");
    expect(serialized).not.toMatch(/email|userId|thread|cards|history|capsule|trace/i);
  });

  it("rejects off mode in production", () => {
    expect(() => resolveSafetyReviewerConfig({
      NODE_ENV: "production",
      AETHERTAROT_SAFETY_REVIEWER_MODE: "off",
    })).toThrowError(/off/);
  });

  it("keeps reviewer deadlines, response cap, model, and bulkhead namespace independent", () => {
    const config = resolveSafetyReviewerConfig({
      NODE_ENV: "production",
      AETHERTAROT_SAFETY_REVIEWER_MODE: "enforce",
      AETHERTAROT_SAFETY_REVIEWER_BASE_URL: "https://reviewer.example.test",
      AETHERTAROT_SAFETY_REVIEWER_MODEL: "reviewer-v2",
      AETHERTAROT_SAFETY_REVIEWER_API_KEY: "reviewer-key",
      AETHERTAROT_SAFETY_REVIEWER_INPUT_DEADLINE_MS: "1700",
      AETHERTAROT_SAFETY_REVIEWER_OUTPUT_DEADLINE_MS: "2600",
      AETHERTAROT_SAFETY_REVIEWER_MAX_OUTPUT_TOKENS: "192",
      AETHERTAROT_SAFETY_REVIEWER_MAX_RESPONSE_BYTES: "16384",
    });

    expect(config.providerConfig?.input).toMatchObject({
      model: "reviewer-v2",
      apiKey: "reviewer-key",
      timeoutMs: 1700,
      maxOutputTokens: 192,
      maxResponseBytes: 16384,
      temperature: 0,
      bulkheadNamespace: "safety-reviewer:safety_input",
    });
    expect(config.providerConfig?.output.timeoutMs).toBe(2600);
    expect(config.providerConfig?.output.bulkheadNamespace)
      .toBe("safety-reviewer:safety_output");
  });

  it("rejects a missing or reused reviewer API key", () => {
    const baseEnv = {
      NODE_ENV: "production",
      AETHERTAROT_SAFETY_REVIEWER_MODE: "enforce",
      AETHERTAROT_SAFETY_REVIEWER_BASE_URL: "https://reviewer.example.test",
      AETHERTAROT_SAFETY_REVIEWER_MODEL: "reviewer-v2",
    } as const;

    expect(() => resolveSafetyReviewerConfig(baseEnv)).toThrowError(/API_KEY/);
    expect(() => resolveSafetyReviewerConfig({
      ...baseEnv,
      AETHERTAROT_LLM_API_KEY: "shared-key",
      AETHERTAROT_SAFETY_REVIEWER_API_KEY: "shared-key",
    })).toThrowError(/不得复用/);
    expect(() => resolveSafetyReviewerConfig({
      ...baseEnv,
      AETHERTAROT_LLM_API_KEY: "$GENERATION_KEY",
      AETHERTAROT_SAFETY_REVIEWER_API_KEY: "${REVIEWER_KEY}",
      GENERATION_KEY: "shared-key",
      REVIEWER_KEY: "shared-key",
    })).toThrowError(/不得复用/);
  });

  it("opens the circuit after repeated failures without another provider call", async () => {
    const provider = buildProvider({
      reviewInput: vi.fn(async () => {
        throw new Error("timeout");
      }),
    });
    const reviewer = buildReviewer({ provider });

    await expect(reviewer.reviewInput({ requestId: "c1", question: "q1", followupAnswers: [] }))
      .rejects.toMatchObject({ status: 503 });
    await expect(reviewer.reviewInput({ requestId: "c2", question: "q2", followupAnswers: [] }))
      .rejects.toMatchObject({ status: 503 });
    await expect(reviewer.reviewInput({ requestId: "c3", question: "q3", followupAnswers: [] }))
      .rejects.toMatchObject({
        status: 503,
        details: expect.objectContaining({ subtype: "circuit_open" }),
      });
    expect(provider.reviewInput).toHaveBeenCalledTimes(2);
  });
});
