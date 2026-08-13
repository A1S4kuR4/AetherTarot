import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { FollowupAnswer, StructuredReading } from "@aethertarot/shared-types";
import {
  OpenAiCompatibleTransport,
  resolveLlmProviderConfig,
  type LlmProviderConfig,
} from "@/server/llm/openai-compatible-transport";
import {
  databaseSafetyReviewerTokenGate,
  type LlmTokenGate,
} from "@/server/beta/token-budget";
import { ReadingServiceError } from "@/server/reading/errors";
import {
  CRISIS_MESSAGE,
  CRISIS_REFERRAL_LINKS,
  MANIPULATION_MESSAGE,
  SAFETY_NOTES,
  SOBER_CHECK,
  type SafetyAssessment,
  type SafetyCategory,
  type SafetyLevel,
} from "@/server/safety/policy";
import type {
  GeneratedContentAction,
  GeneratedContentViolation,
} from "@/server/safety/output-validator";

export type SafetyReviewerMode = "off" | "shadow" | "enforce";
export type SafetyReviewerPurpose = "safety_input" | "safety_output";
export type SafetyReferralKind =
  | "none"
  | "crisis"
  | "emergency_services"
  | "abuse_support"
  | "professional_support";

const safetyLevelSchema = z.enum([
  "standard",
  "bounded",
  "sober_check",
  "hard_stop",
]);
const safetyCategorySchema = z.enum([
  "self_harm",
  "immediate_danger",
  "urgent_health",
  "manipulation",
  "abuse_support",
  "self_harm_support",
  "health",
  "legal",
  "financial",
  "major_decision",
  "third_party_certainty",
  "relationship_conflict",
]);
const referralKindSchema = z.enum([
  "none",
  "crisis",
  "emergency_services",
  "abuse_support",
  "professional_support",
]);
const generatedContentViolationSchema = z.enum([
  "self_harm_or_violence_encouragement",
  "manipulation_instruction",
  "treatment_discontinuation",
  "medical_diagnosis",
  "abuse_minimization",
  "deterministic_claim",
  "third_party_certainty",
  "professional_directive",
]);
const flaggedPathSchema = z.string().regex(
  /^(?:cards\.\d+\.interpretation|themes\.\d+|synthesis|reflective_guidance\.\d+|follow_up_questions\.\d+|safety_note|confidence_note|answer|boundary_note)$/,
);

export function inputSafetyReviewVerdictSchema({
  policyVersion,
  modelVersion,
}: {
  policyVersion: string;
  modelVersion: string;
}) {
  return z.object({
    level: safetyLevelSchema,
    categories: z.array(safetyCategorySchema).max(12),
    referral_kind: referralKindSchema,
    policy_version: z.literal(policyVersion),
    model_version: z.literal(modelVersion),
  }).strict();
}

export function outputSafetyReviewVerdictSchema({
  policyVersion,
  modelVersion,
}: {
  policyVersion: string;
  modelVersion: string;
}) {
  return z.object({
    action: z.enum(["pass", "restrict", "replace"]),
    violations: z.array(generatedContentViolationSchema).max(8),
    flagged_paths: z.array(flaggedPathSchema).max(64),
    policy_version: z.literal(policyVersion),
    model_version: z.literal(modelVersion),
  }).strict();
}

export type SafetyInputReviewVerdict = z.infer<ReturnType<typeof inputSafetyReviewVerdictSchema>>;
export type SafetyOutputReviewVerdict = z.infer<ReturnType<typeof outputSafetyReviewVerdictSchema>>;

const inputReviewProtocolSchema = z.object({
  protocol: z.literal("aethertarot_safety_input_v1"),
  question: z.string(),
  followup_answers: z.array(z.object({
    field: z.string().regex(/^followup_answers\.\d+\.answer$/),
    answer: z.string(),
  }).strict()),
  deterministic: z.object({
    level: safetyLevelSchema,
    categories: z.array(safetyCategorySchema),
    referral_kind: referralKindSchema,
  }).strict(),
  policy_version: z.string().min(1),
  model_version: z.string().min(1),
}).strict();

const outputReviewProtocolSchema = z.object({
  protocol: z.literal("aethertarot_safety_output_v1"),
  content: z.array(z.object({ path: flaggedPathSchema, text: z.string() }).strict()),
  deterministic: z.object({
    action: z.enum(["pass", "restrict", "replace"]),
    violations: z.array(generatedContentViolationSchema),
  }).strict(),
  policy_version: z.string().min(1),
  model_version: z.string().min(1),
}).strict();

export type SafetyInputReviewProtocol = z.infer<typeof inputReviewProtocolSchema>;
export type SafetyOutputReviewProtocol = z.infer<typeof outputReviewProtocolSchema>;

export interface SafetyReviewerProvider {
  reviewInput(input: SafetyInputReviewProtocol, signal?: AbortSignal): Promise<SafetyInputReviewVerdict>;
  reviewOutput(input: SafetyOutputReviewProtocol, signal?: AbortSignal): Promise<SafetyOutputReviewVerdict>;
}

export interface SafetyReviewerConfig {
  mode: SafetyReviewerMode;
  policyVersion: string;
  model: string;
  cacheTtlMs: number;
  cacheHmacSecret: string;
  rateLimitPerMinute: number;
  circuitFailureThreshold: number;
  circuitResetMs: number;
  providerConfig?: {
    input: LlmProviderConfig;
    output: LlmProviderConfig;
  };
}

export interface SafetyReviewerMetric {
  requestId?: string;
  runId?: string;
  purpose: SafetyReviewerPurpose;
  policyVersion: string;
  modelVersion: string;
  mode: SafetyReviewerMode;
  decision: SafetyLevel | GeneratedContentAction | "error";
  categories: SafetyCategory[];
  violations: GeneratedContentViolation[];
  durationMs: number;
  cacheHit: boolean;
  errorCode?: string;
  circuitState: "closed" | "open" | "half_open";
}

export interface SafetyReviewExecution<T> {
  mode: SafetyReviewerMode;
  applied: boolean;
  verdict: T;
  cacheHit: boolean;
}

type ReviewerEnvironment = Partial<NodeJS.ProcessEnv> & { NODE_ENV?: string };

function readString(env: ReviewerEnvironment, name: string, fallback = "") {
  return env[name]?.trim() || fallback;
}

function readInteger(
  env: ReviewerEnvironment,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ReadingServiceError(
      "provider_unavailable",
      `${name} 必须是 ${min}-${max} 的整数。`,
      503,
    );
  }
  return value;
}

export function resolveSafetyReviewerConfig(
  env: ReviewerEnvironment = process.env,
): SafetyReviewerConfig {
  const rawMode = readString(env, "AETHERTAROT_SAFETY_REVIEWER_MODE", "off");
  if (!(["off", "shadow", "enforce"] as const).includes(rawMode as SafetyReviewerMode)) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "AETHERTAROT_SAFETY_REVIEWER_MODE 必须是 off、shadow 或 enforce。",
      503,
    );
  }
  const mode = rawMode as SafetyReviewerMode;
  if (env.NODE_ENV === "production" && mode === "off") {
    throw new ReadingServiceError(
      "provider_unavailable",
      "生产环境不允许将 LLM Safety Reviewer 配置为 off。",
      503,
    );
  }

  const policyVersion = readString(
    env,
    "AETHERTAROT_SAFETY_REVIEWER_POLICY_VERSION",
    "safety-reviewer-v1",
  );
  const model = readString(env, "AETHERTAROT_SAFETY_REVIEWER_MODEL", "off");
  const cacheHmacSecret = readString(
    env,
    "AETHERTAROT_SAFETY_REVIEWER_CACHE_HMAC_SECRET",
    randomBytes(32).toString("hex"),
  );
  const base = {
    mode,
    policyVersion,
    model,
    cacheTtlMs: readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_CACHE_TTL_MS", 30_000, 1_000, 300_000),
    cacheHmacSecret,
    rateLimitPerMinute: readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_RATE_LIMIT_PER_MINUTE", 120, 1, 10_000),
    circuitFailureThreshold: readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_CIRCUIT_FAILURE_THRESHOLD", 3, 1, 100),
    circuitResetMs: readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_CIRCUIT_RESET_MS", 30_000, 1_000, 600_000),
  };
  if (mode === "off") return base;

  const baseUrl = readString(env, "AETHERTAROT_SAFETY_REVIEWER_BASE_URL");
  const apiKey = readString(env, "AETHERTAROT_SAFETY_REVIEWER_API_KEY");
  if (!baseUrl || !model || model === "off" || !apiKey) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "LLM Safety Reviewer 需要独立配置 BASE_URL、MODEL 和 API_KEY。",
      503,
    );
  }
  if (apiKey === readString(env, "AETHERTAROT_LLM_API_KEY")) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "LLM Safety Reviewer 不得复用正文生成 API_KEY。",
      503,
    );
  }
  const maxOutputTokens = readInteger(
    env,
    "AETHERTAROT_SAFETY_REVIEWER_MAX_OUTPUT_TOKENS",
    192,
    128,
    256,
  );
  const maxResponseBytes = readInteger(
    env,
    "AETHERTAROT_SAFETY_REVIEWER_MAX_RESPONSE_BYTES",
    32 * 1024,
    16 * 1024,
    32 * 1024,
  );
  const queueTimeoutMs = readInteger(
    env,
    "AETHERTAROT_SAFETY_REVIEWER_QUEUE_TIMEOUT_MS",
    300,
    100,
    2_000,
  );
  const commonEnv = {
    ...env,
    AETHERTAROT_LLM_BASE_URL: baseUrl,
    AETHERTAROT_LLM_MODEL: model,
    AETHERTAROT_LLM_API_KEY: apiKey,
    AETHERTAROT_LLM_TEMPERATURE: "0",
    AETHERTAROT_LLM_RESPONSE_FORMAT: "json_object",
    AETHERTAROT_LLM_MAX_OUTPUT_TOKENS: String(maxOutputTokens),
    AETHERTAROT_LLM_MAX_RESPONSE_BYTES: String(maxResponseBytes),
    AETHERTAROT_LLM_MAX_CONCURRENCY: readString(env, "AETHERTAROT_SAFETY_REVIEWER_MAX_CONCURRENCY", "2"),
    AETHERTAROT_LLM_MAX_QUEUE: readString(env, "AETHERTAROT_SAFETY_REVIEWER_MAX_QUEUE", "4"),
    AETHERTAROT_LLM_QUEUE_TIMEOUT_MS: String(queueTimeoutMs),
  };
  const buildProviderConfig = (timeoutMs: number, purpose: SafetyReviewerPurpose) => ({
    ...resolveLlmProviderConfig({
      ...commonEnv,
      AETHERTAROT_LLM_TIMEOUT_MS: String(timeoutMs),
    }),
    bulkheadNamespace: `safety-reviewer:${purpose}`,
  });

  return {
    ...base,
    providerConfig: {
      input: buildProviderConfig(
        readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_INPUT_DEADLINE_MS", 1_800, 500, 5_000),
        "safety_input",
      ),
      output: buildProviderConfig(
        readInteger(env, "AETHERTAROT_SAFETY_REVIEWER_OUTPUT_DEADLINE_MS", 2_500, 500, 5_000),
        "safety_output",
      ),
    },
  };
}

function inputReferralKind(assessment: SafetyAssessment): SafetyReferralKind {
  if (assessment.level === "hard_stop") {
    return assessment.primaryCategory === "manipulation"
      ? "none"
      : "crisis";
  }
  if (assessment.primaryCategory === "abuse_support") return "abuse_support";
  if (["health", "legal", "financial"].some((category) =>
    assessment.categories.includes(category as SafetyCategory)
  )) return "professional_support";
  return "none";
}

function buildInputProtocol({
  question,
  followupAnswers,
  deterministic,
  policyVersion,
  modelVersion,
}: {
  question: string;
  followupAnswers: readonly string[];
  deterministic: SafetyAssessment;
  policyVersion: string;
  modelVersion: string;
}) {
  return inputReviewProtocolSchema.parse({
    protocol: "aethertarot_safety_input_v1",
    question,
    followup_answers: followupAnswers.map((answer, index) => ({
      field: `followup_answers.${index}.answer`,
      answer,
    })),
    deterministic: {
      level: deterministic.level,
      categories: deterministic.categories,
      referral_kind: inputReferralKind(deterministic),
    },
    policy_version: policyVersion,
    model_version: modelVersion,
  });
}

function buildOutputProtocol({
  fields,
  deterministicAction,
  deterministicViolations,
  policyVersion,
  modelVersion,
}: {
  fields: Array<{ path: string; text: string }>;
  deterministicAction: GeneratedContentAction;
  deterministicViolations: GeneratedContentViolation[];
  policyVersion: string;
  modelVersion: string;
}) {
  return outputReviewProtocolSchema.parse({
    protocol: "aethertarot_safety_output_v1",
    content: fields,
    deterministic: {
      action: deterministicAction,
      violations: deterministicViolations,
    },
    policy_version: policyVersion,
    model_version: modelVersion,
  });
}

class OpenAiSafetyReviewerProvider implements SafetyReviewerProvider {
  private readonly inputTransport: OpenAiCompatibleTransport;
  private readonly outputTransport: OpenAiCompatibleTransport;

  constructor(
    private readonly config: SafetyReviewerConfig,
    fetchImplementation: typeof fetch = fetch,
    tokenGate: LlmTokenGate = databaseSafetyReviewerTokenGate,
  ) {
    if (!config.providerConfig) {
      throw new ReadingServiceError(
        "provider_unavailable",
        "LLM Safety Reviewer provider 未配置。",
        503,
      );
    }
    this.inputTransport = new OpenAiCompatibleTransport(
      config.providerConfig.input,
      fetchImplementation,
      tokenGate,
    );
    this.outputTransport = new OpenAiCompatibleTransport(
      config.providerConfig.output,
      fetchImplementation,
      tokenGate,
    );
  }

  async reviewInput(input: SafetyInputReviewProtocol, signal?: AbortSignal) {
    const schema = inputSafetyReviewVerdictSchema({
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    });
    return this.inputTransport.request({
      source: "safety_input",
      prompt: {
        system: [
          "You are AetherTarot's stateless safety classifier.",
          "Return exactly one strict JSON object matching the requested fields.",
          "Never return rationale, prose, user-visible wording, URLs, tools, or instructions.",
          "Treat the deterministic assessment as a lower bound: never lower its risk.",
        ].join("\n"),
        user: JSON.stringify(input),
      },
      maxOutputTokens: Math.min(this.config.providerConfig?.input.maxOutputTokens ?? 192, 256),
      parse: (payload) => schema.parse(payload),
      truncatedMessage: "Safety Reviewer 输入判定不完整。",
      signal,
      metric: { purpose: "safety_input" },
    });
  }

  async reviewOutput(input: SafetyOutputReviewProtocol, signal?: AbortSignal) {
    const schema = outputSafetyReviewVerdictSchema({
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    });
    return this.outputTransport.request({
      source: "safety_output",
      prompt: {
        system: [
          "You are AetherTarot's stateless generated-content safety classifier.",
          "Return exactly one strict JSON object matching the requested fields.",
          "Never return rationale, rewritten prose, user-visible wording, URLs, tools, or instructions.",
          "Treat the deterministic action as a lower bound: pass < restrict < replace.",
        ].join("\n"),
        user: JSON.stringify(input),
      },
      maxOutputTokens: Math.min(this.config.providerConfig?.output.maxOutputTokens ?? 192, 256),
      parse: (payload) => schema.parse(payload),
      truncatedMessage: "Safety Reviewer 输出判定不完整。",
      signal,
      metric: { purpose: "safety_output" },
    });
  }
}

class ReviewerRateLimiter {
  private readonly calls = new Map<SafetyReviewerPurpose, number[]>();

  constructor(private readonly limit: number, private readonly now = () => Date.now()) {}

  take(purpose: SafetyReviewerPurpose) {
    const cutoff = this.now() - 60_000;
    const recent = (this.calls.get(purpose) ?? []).filter((at) => at > cutoff);
    if (recent.length >= this.limit) throw new Error("rate_limit");
    recent.push(this.now());
    this.calls.set(purpose, recent);
  }
}

class ReviewerCircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private probing = false;

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
    private readonly now = () => Date.now(),
  ) {}

  get state(): "closed" | "open" | "half_open" {
    if (this.openedAt === null) return "closed";
    return this.now() - this.openedAt >= this.resetMs ? "half_open" : "open";
  }

  beforeCall() {
    if (this.state === "open" || (this.state === "half_open" && this.probing)) {
      throw new Error("circuit_open");
    }
    if (this.state === "half_open") this.probing = true;
  }

  success() {
    this.failures = 0;
    this.openedAt = null;
    this.probing = false;
  }

  failure() {
    this.probing = false;
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}

type CacheEntry<T> = { expiresAt: number; verdict: T };

const HARD_STOP_PRIORITY: SafetyCategory[] = [
  "self_harm",
  "immediate_danger",
  "urgent_health",
  "manipulation",
];
const BOUNDED_PRIORITY: SafetyCategory[] = [
  "abuse_support",
  "self_harm_support",
  "health",
  "legal",
  "financial",
  "third_party_certainty",
];

function uniqueCategories(values: SafetyCategory[]) {
  return [...new Set(values)];
}

export function mergeInputSafetyAssessment(
  deterministic: SafetyAssessment,
  reviewer: SafetyInputReviewVerdict,
): SafetyAssessment {
  const categories = uniqueCategories([
    ...deterministic.categories,
    ...reviewer.categories,
  ]);
  const hasAbuseSupport = deterministic.primaryCategory === "abuse_support"
    || (reviewer.level === "bounded" && reviewer.categories.includes("abuse_support"));
  const level: SafetyLevel = deterministic.level === "hard_stop" || reviewer.level === "hard_stop"
    ? "hard_stop"
    : hasAbuseSupport
      ? "bounded"
      : deterministic.level === "sober_check" || reviewer.level === "sober_check"
        ? "sober_check"
        : deterministic.level === "bounded" || reviewer.level === "bounded"
          ? "bounded"
          : "standard";

  if (level === "hard_stop") {
    const primaryCategory = deterministic.level === "hard_stop"
      ? deterministic.primaryCategory
      : HARD_STOP_PRIORITY.find((category) => categories.includes(category)) ?? "self_harm";
    const manipulation = primaryCategory === "manipulation";
    return {
      level,
      primaryCategory,
      categories,
      userMessage: deterministic.level === "hard_stop"
        ? deterministic.userMessage
        : manipulation
          ? MANIPULATION_MESSAGE
          : CRISIS_MESSAGE,
      safetyNote: null,
      soberCheck: null,
      referralLinks: deterministic.referralLinks
        ?? (reviewer.referral_kind === "crisis" || reviewer.referral_kind === "emergency_services"
          ? CRISIS_REFERRAL_LINKS
          : undefined),
    };
  }

  if (level === "sober_check") {
    return {
      level,
      primaryCategory: "major_decision",
      categories,
      userMessage: null,
      safetyNote: deterministic.safetyNote ?? SAFETY_NOTES.major_decision ?? null,
      soberCheck: deterministic.soberCheck ?? SOBER_CHECK,
    };
  }

  if (level === "bounded") {
    const primaryCategory = hasAbuseSupport
      ? "abuse_support"
      : deterministic.level === "bounded" && deterministic.primaryCategory
        ? deterministic.primaryCategory
        : BOUNDED_PRIORITY.find((category) => categories.includes(category)) ?? "health";
    return {
      level,
      primaryCategory,
      categories,
      userMessage: null,
      safetyNote: deterministic.safetyNote ?? SAFETY_NOTES[primaryCategory] ?? null,
      soberCheck: null,
    };
  }

  return {
    level: "standard",
    primaryCategory: deterministic.primaryCategory,
    categories,
    userMessage: null,
    safetyNote: null,
    soberCheck: null,
  };
}

export class LLMSafetyReviewer {
  private readonly provider: SafetyReviewerProvider | null;
  private readonly rateLimiter: ReviewerRateLimiter;
  private readonly circuits: Record<SafetyReviewerPurpose, ReviewerCircuitBreaker>;
  private readonly cache = new Map<string, CacheEntry<SafetyInputReviewVerdict | SafetyOutputReviewVerdict>>();
  private readonly recordMetric: (metric: SafetyReviewerMetric) => void;

  constructor({
    config,
    provider,
    recordMetric = (metric) => console.info("[safety-reviewer]", metric),
  }: {
    config: SafetyReviewerConfig;
    provider?: SafetyReviewerProvider;
    recordMetric?: (metric: SafetyReviewerMetric) => void;
  }) {
    this.config = config;
    this.provider = provider ?? (config.mode === "off" ? null : new OpenAiSafetyReviewerProvider(config));
    this.rateLimiter = new ReviewerRateLimiter(config.rateLimitPerMinute);
    this.circuits = {
      safety_input: new ReviewerCircuitBreaker(config.circuitFailureThreshold, config.circuitResetMs),
      safety_output: new ReviewerCircuitBreaker(config.circuitFailureThreshold, config.circuitResetMs),
    };
    this.recordMetric = recordMetric;
  }

  private readonly config: SafetyReviewerConfig;

  private cacheKey(purpose: SafetyReviewerPurpose, requestId: string | undefined, protocol: unknown) {
    if (!requestId) return null;
    return createHmac("sha256", this.config.cacheHmacSecret)
      .update(`${purpose}\n${requestId}\n${JSON.stringify(protocol)}`)
      .digest("hex");
  }

  private readCache<T>(key: string | null) {
    if (!key) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.verdict as T;
  }

  private writeCache(key: string | null, verdict: SafetyInputReviewVerdict | SafetyOutputReviewVerdict) {
    if (!key) return;
    this.cache.set(key, { expiresAt: Date.now() + this.config.cacheTtlMs, verdict });
  }

  private metric(
    purpose: SafetyReviewerPurpose,
    input: { requestId?: string; runId?: string },
    startedAt: number,
    decision: SafetyReviewerMetric["decision"],
    options: {
      categories?: SafetyCategory[];
      violations?: GeneratedContentViolation[];
      cacheHit?: boolean;
      errorCode?: string;
    } = {},
  ) {
    this.recordMetric({
      requestId: input.requestId,
      runId: input.runId,
      purpose,
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
      mode: this.config.mode,
      decision,
      categories: options.categories ?? [],
      violations: options.violations ?? [],
      durationMs: Date.now() - startedAt,
      cacheHit: options.cacheHit ?? false,
      errorCode: options.errorCode,
      circuitState: this.circuits[purpose].state,
    });
  }

  private unavailable(purpose: SafetyReviewerPurpose, cause: unknown) {
    const subtype = cause instanceof Error ? cause.message : "reviewer_failure";
    return new ReadingServiceError(
      "provider_unavailable",
      "安全审校服务暂时不可用，请稍后重试。",
      503,
      undefined,
      undefined,
      { purpose, subtype: subtype.slice(0, 64), circuit_state: this.circuits[purpose].state },
    );
  }

  async reviewInput({
    requestId,
    runId,
    question,
    followupAnswers,
    deterministic,
    signal,
  }: {
    requestId?: string;
    runId?: string;
    question: string;
    followupAnswers: readonly string[] | FollowupAnswer[];
    deterministic?: SafetyAssessment;
    signal?: AbortSignal;
  }): Promise<SafetyReviewExecution<SafetyInputReviewVerdict>> {
    const startedAt = Date.now();
    const normalizedAnswers = followupAnswers.map((answer) =>
      typeof answer === "string" ? answer : answer.answer
    );
    const baseline = deterministic ?? {
      level: "standard" as const,
      primaryCategory: null,
      categories: [],
      userMessage: null,
      safetyNote: null,
      soberCheck: null,
    };
    const protocol = buildInputProtocol({
      question,
      followupAnswers: normalizedAnswers,
      deterministic: baseline,
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    });
    const fallback = inputSafetyReviewVerdictSchema({
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    }).parse({
      level: baseline.level,
      categories: baseline.categories,
      referral_kind: inputReferralKind(baseline),
      policy_version: this.config.policyVersion,
      model_version: this.config.model,
    });
    if (this.config.mode === "off") {
      return { mode: "off", applied: false, verdict: fallback, cacheHit: false };
    }

    const key = this.cacheKey("safety_input", requestId, protocol);
    const cached = this.readCache<SafetyInputReviewVerdict>(key);
    if (cached) {
      this.metric("safety_input", { requestId, runId }, startedAt, cached.level, {
        categories: cached.categories,
        cacheHit: true,
      });
      return { mode: this.config.mode, applied: this.config.mode === "enforce", verdict: cached, cacheHit: true };
    }

    try {
      this.rateLimiter.take("safety_input");
      this.circuits.safety_input.beforeCall();
      const verdict = await this.provider?.reviewInput(protocol, signal);
      if (!verdict) throw new Error("provider_missing");
      const validated = inputSafetyReviewVerdictSchema({
        policyVersion: this.config.policyVersion,
        modelVersion: this.config.model,
      }).parse(verdict);
      this.circuits.safety_input.success();
      this.writeCache(key, validated);
      this.metric("safety_input", { requestId, runId }, startedAt, validated.level, {
        categories: validated.categories,
      });
      return {
        mode: this.config.mode,
        applied: this.config.mode === "enforce",
        verdict: validated,
        cacheHit: false,
      };
    } catch (error) {
      this.circuits.safety_input.failure();
      this.metric("safety_input", { requestId, runId }, startedAt, "error", {
        errorCode: "provider_unavailable",
      });
      if (this.config.mode === "shadow") {
        return { mode: "shadow", applied: false, verdict: fallback, cacheHit: false };
      }
      throw this.unavailable("safety_input", error);
    }
  }

  async reviewOutput({
    requestId,
    runId,
    reading,
    deterministicAction,
    deterministicViolations,
    signal,
  }: {
    requestId?: string;
    runId?: string;
    reading: StructuredReading;
    deterministicAction: GeneratedContentAction;
    deterministicViolations: GeneratedContentViolation[];
    signal?: AbortSignal;
  }): Promise<SafetyReviewExecution<SafetyOutputReviewVerdict>> {
    const listFields = (values: string[], prefix: string) => values.map((text, index) => ({
      path: `${prefix}.${index}`,
      text,
    }));
    return this.reviewOutputFields({
      requestId,
      runId,
      fields: [
        ...reading.cards.map((card, index) => ({
          path: `cards.${index}.interpretation`,
          text: card.interpretation,
        })),
        ...listFields(reading.themes, "themes"),
        { path: "synthesis", text: reading.synthesis },
        ...listFields(reading.reflective_guidance, "reflective_guidance"),
        ...listFields(reading.follow_up_questions, "follow_up_questions"),
        ...(reading.safety_note ? [{ path: "safety_note", text: reading.safety_note }] : []),
        ...(reading.confidence_note ? [{ path: "confidence_note", text: reading.confidence_note }] : []),
      ],
      deterministicAction,
      deterministicViolations,
      signal,
    });
  }

  async reviewEncyclopediaOutput({
    requestId,
    runId,
    answer,
    boundaryNote,
    deterministicAction,
    deterministicViolations,
    signal,
  }: {
    requestId?: string;
    runId?: string;
    answer: string;
    boundaryNote: string | null;
    deterministicAction: GeneratedContentAction;
    deterministicViolations: GeneratedContentViolation[];
    signal?: AbortSignal;
  }) {
    return this.reviewOutputFields({
      requestId,
      runId,
      fields: [
        { path: "answer", text: answer },
        ...(boundaryNote ? [{ path: "boundary_note", text: boundaryNote }] : []),
      ],
      deterministicAction,
      deterministicViolations,
      signal,
    });
  }

  private async reviewOutputFields({
    requestId,
    runId,
    fields,
    deterministicAction,
    deterministicViolations,
    signal,
  }: {
    requestId?: string;
    runId?: string;
    fields: Array<{ path: string; text: string }>;
    deterministicAction: GeneratedContentAction;
    deterministicViolations: GeneratedContentViolation[];
    signal?: AbortSignal;
  }): Promise<SafetyReviewExecution<SafetyOutputReviewVerdict>> {
    const startedAt = Date.now();
    const protocol = buildOutputProtocol({
      fields,
      deterministicAction,
      deterministicViolations,
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    });
    const fallback = outputSafetyReviewVerdictSchema({
      policyVersion: this.config.policyVersion,
      modelVersion: this.config.model,
    }).parse({
      action: deterministicAction,
      violations: deterministicViolations,
      flagged_paths: [],
      policy_version: this.config.policyVersion,
      model_version: this.config.model,
    });
    if (this.config.mode === "off") {
      return { mode: this.config.mode, applied: false, verdict: fallback, cacheHit: false };
    }

    const key = this.cacheKey("safety_output", requestId, protocol);
    const cached = this.readCache<SafetyOutputReviewVerdict>(key);
    if (cached) {
      this.metric("safety_output", { requestId, runId }, startedAt, cached.action, {
        violations: cached.violations,
        cacheHit: true,
      });
      return { mode: this.config.mode, applied: this.config.mode === "enforce", verdict: cached, cacheHit: true };
    }

    try {
      this.rateLimiter.take("safety_output");
      this.circuits.safety_output.beforeCall();
      const verdict = await this.provider?.reviewOutput(protocol, signal);
      if (!verdict) throw new Error("provider_missing");
      const validated = outputSafetyReviewVerdictSchema({
        policyVersion: this.config.policyVersion,
        modelVersion: this.config.model,
      }).parse(verdict);
      this.circuits.safety_output.success();
      this.writeCache(key, validated);
      this.metric("safety_output", { requestId, runId }, startedAt, validated.action, {
        violations: validated.violations,
      });
      return {
        mode: this.config.mode,
        applied: this.config.mode === "enforce",
        verdict: validated,
        cacheHit: false,
      };
    } catch (error) {
      this.circuits.safety_output.failure();
      this.metric("safety_output", { requestId, runId }, startedAt, "error", {
        errorCode: "provider_unavailable",
      });
      if (this.config.mode === "shadow") {
        return { mode: "shadow", applied: false, verdict: fallback, cacheHit: false };
      }
      throw this.unavailable("safety_output", error);
    }
  }
}

let defaultReviewer: LLMSafetyReviewer | null = null;

export function getLLMSafetyReviewer() {
  if (!defaultReviewer) {
    defaultReviewer = new LLMSafetyReviewer({ config: resolveSafetyReviewerConfig() });
  }
  return defaultReviewer;
}

export type SafetyReviewer = Pick<
  LLMSafetyReviewer,
  "reviewInput" | "reviewOutput" | "reviewEncyclopediaOutput"
>;

export const defaultLLMSafetyReviewer: SafetyReviewer = {
  reviewInput: (input) => getLLMSafetyReviewer().reviewInput(input),
  reviewOutput: (input) => getLLMSafetyReviewer().reviewOutput(input),
  reviewEncyclopediaOutput: (input) =>
    getLLMSafetyReviewer().reviewEncyclopediaOutput(input),
};
