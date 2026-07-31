import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAllCards, getAllSpreads } from "@aethertarot/domain-tarot";
import type {
  AgentProfile,
  FollowupAnswer,
  QuestionType,
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import {
  createLlmReadingProviderFromEnv,
  resolveLlmProviderConfig,
} from "../src/server/reading/llm-provider";
import {
  OpenAiCompatibleTransport,
} from "../src/server/llm/openai-compatible-transport";
import {
  ReadingGenerationError,
  ReadingServiceError,
  isReadingGenerationError,
  isReadingServiceError,
} from "../src/server/reading/errors";
import type {
  ReadingGenerationMode,
} from "../src/server/reading/generation-policy";
import {
  runReadingGraphWithDiagnostics,
} from "../src/server/reading/graph";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingGenerationCallOptions,
  ReadingProvider,
  RepairStageRequest,
} from "../src/server/reading/types";
import {
  isExtractiveCardPileup,
  type CardInsightDraft,
  type CompactReadingDraft,
  type FinalSynthesisDraft,
  type ReadingStageDraft,
  type SynthesisDraft,
} from "../src/server/reading/generation-contracts";
import {
  collectLlmUsage,
  summarizeLlmCalls,
  unwrapLlmUsageError,
  type LlmCallMetric,
} from "../src/server/observability/llm-usage";
import {
  collectLlmRawCompletions,
  unwrapLlmRawCompletionError,
  type LlmRawCompletion,
} from "../src/server/observability/llm-raw-completions";
import { createCanaryTokenGate } from "../src/server/quality/canary";
import {
  getReservationTokenCount,
  type LlmTokenGate,
} from "../src/server/beta/token-budget";

const OUTPUT_ROOT = path.resolve(process.cwd(), "..", "..", "outputs", "evals");
const GRAPH_EXECUTION_LIMIT = 200;
const TOKEN_BUDGET = 2_500_000;
const RAW_REQUEST_LIMIT = 650;
const EVALUATOR_TOKEN_BUDGET = 2_500_000;
const EVALUATOR_REQUEST_LIMIT = 100;
const BOOTSTRAP_SAMPLES = 10_000;
const BOOTSTRAP_SEED = 20260731;
const MATRIX_SEED = 2026073101;
const PROSE_LEAK_PATTERN =
  /本地知识库(?:片段|检索)|source_?id|grounding_claims|第一阶段|第二阶段|provider|prompt|generation stage/iu;
const DETERMINISTIC_CLAIM_PATTERN =
  /一定会|必然会|命中注定|百分之百|必须(?:分手|辞职|结婚|投资)/u;
const DUPLICATE_PERIOD_PATTERN = /(?:。|\.)\s*(?:。|\.)/u;
const SINGLE_FAKE_PATH_PATTERN = /一路带到|从\s*核心指引\s*(?:一路)?带到\s*核心指引/u;

function positiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

type Arm = "monolithic" | "adaptive_staged";
type Scenario = "lite_initial" | "standard_initial" | "sober_final_prep" | "sober_final";

const QUESTION_FIXTURES: Record<QuestionType, [string, string, string]> = {
  relationship: [
    "最近的关系互动里，我最需要看清什么边界？",
    "这段关系目前的沟通张力怎样影响彼此靠近的节奏？",
    "如果我不再猜测对方的想法，这段关系里最值得先核实的现实信号是什么？",
  ],
  career: [
    "接下来的工作重心，我适合先聚焦在哪里？",
    "当前项目停滞背后，哪些行动条件与协作关系最需要重新梳理？",
    "面对转岗机会，我应如何区分真实资源、成长期待与暂时焦虑？",
  ],
  self_growth: [
    "我现在真正需要看清的内在状态是什么？",
    "反复拖延与自我怀疑之间，可能存在怎样的成长课题？",
    "如果不急着改变自己，我最需要先理解哪个反复出现的模式？",
  ],
  decision: [
    "面对两个方向，我目前最需要比较什么？",
    "是否接受这次合作，我还没有核实哪些条件与代价？",
    "在做出搬家决定前，我怎样区分事实、期待与风险承受边界？",
  ],
  other: [
    "这周最值得我留意的生活节奏是什么？",
    "最近的学习安排为什么反复失去节奏，我可以从哪里重新整理？",
    "围绕眼前这次变化，我最值得先观察哪一个现实反馈？",
  ],
};

const FOLLOWUP_ANSWERS: Record<QuestionType, string> = {
  relationship: "我确认自己最在意的是沟通是否稳定，而不是猜测对方会不会给出承诺。",
  career: "目前确定的事实是团队资源有限，但我可以先用两周验证职责与支持是否清楚。",
  self_growth: "我发现这个模式在压力大时最明显，我愿意先记录触发点而不是立刻否定自己。",
  decision: "我能承受的风险有明确上限，也还有两项现实信息没有核实。",
  other: "我愿意先观察一周的实际反馈，再决定是否扩大行动。",
};

const RUBRIC_DIMENSIONS = [
  "question_relevance",
  "spread_logic",
  "holistic_synthesis",
  "card_specificity",
  "constructive_tension",
  "safety_boundary",
  "uncertainty_calibration",
  "actionable_guidance",
  "natural_language",
  "orientation_respect",
  "card_synthesis_consistency",
  "final_integration",
] as const;

interface ExecutionResult {
  execution_id: string;
  pair_id: string;
  arm: Arm;
  scenario: Scenario;
  scored: boolean;
  duration_ms: number;
  payload: ReadingRequestPayload;
  reading: StructuredReading | null;
  trace: Awaited<ReturnType<typeof runReadingGraphWithDiagnostics>>["trace"] | null;
  calls: LlmCallMetric[];
  usage: ReturnType<typeof summarizeLlmCalls>;
  raw_completions: LlmRawCompletion[];
  checks: Record<string, boolean>;
  error: {
    code?: string;
    subtype?: string;
    stage?: string;
    message: string;
  } | null;
}

interface RubricResult {
  pair_id: string;
  label_order: { A: Arm; B: Arm };
  winner: "A" | "B" | "tie";
  scores: Record<string, { A: number; B: number }>;
  rationale: string;
  swapped_review: boolean;
  conflict?: boolean;
}

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed && process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
  process.env.AETHERTAROT_LLM_THINKING_MODE = "disabled";
  process.env.AETHERTAROT_LLM_RESPONSE_FORMAT = "json_object";
}

function visibleProse(reading: StructuredReading) {
  return [
    ...reading.cards.map((card) => card.interpretation),
    ...reading.themes,
    reading.synthesis,
    ...reading.reflective_guidance,
    ...reading.follow_up_questions,
    reading.confidence_note ?? "",
    reading.safety_note ?? "",
  ].join("\n");
}

function rubricReadingView(reading: StructuredReading) {
  return {
    question_type: reading.question_type,
    agent_profile: reading.agent_profile,
    reading_phase: reading.reading_phase,
    cards: reading.cards.map((card) => ({
      name: card.name,
      orientation: card.orientation,
      position: card.position,
      position_meaning: card.position_meaning,
      interpretation: card.interpretation,
    })),
    themes: reading.themes,
    synthesis: reading.synthesis,
    reflective_guidance: reading.reflective_guidance,
    follow_up_questions: reading.follow_up_questions,
    safety_note: reading.safety_note,
    confidence_note: reading.confidence_note,
    sober_check: reading.sober_check,
    presentation_mode: reading.presentation_mode,
  };
}

function evaluateChecks(
  reading: StructuredReading,
  payload: ReadingRequestPayload,
) {
  const prose = visibleProse(reading);
  const sourceRefs = new Set(
    reading.grounding?.sources.map((source) => source.ref) ?? [],
  );
  const claims = reading.grounding?.claims ?? [];
  const expectedPaths = [
    ...reading.cards.map((_, index) => `cards.${index}.interpretation`),
    "synthesis",
  ];
  const mentionedCards = reading.cards.filter((card) =>
    reading.synthesis.includes(card.name)
  ).length;
  return {
    authority: reading.cards.length === payload.drawnCards.length
      && reading.cards.every((card, index) => {
        const expected = payload.drawnCards[index];
        return Boolean(
          expected
          && card.card_id === expected.cardId
          && card.position_id === expected.positionId
          && card.orientation === (expected.isReversed ? "reversed" : "upright"),
        );
      }),
    grounding: expectedPaths.every((pathName) =>
      claims.some((claim) => claim.path === pathName)
    ) && claims.every((claim) =>
      claim.source_refs.every((ref) => sourceRefs.has(ref))
    ),
    no_prose_leakage: !PROSE_LEAK_PATTERN.test(prose),
    no_duplicate_punctuation: !DUPLICATE_PERIOD_PATTERN.test(prose),
    no_single_fake_path:
      reading.spread.id !== "single"
      || !SINGLE_FAKE_PATH_PATTERN.test(reading.synthesis),
    no_multi_card_pileup:
      !isExtractiveCardPileup(reading.synthesis, reading.cards)
      && (
        reading.cards.length <= 1
        || mentionedCards < Math.ceil(reading.cards.length * 0.7)
        || !/(?:^|\s)(?:1[.)、]|2[.)、]|3[.)、])|首先.{0,40}(?:其次|然后)|第一张.{0,60}第二张/u.test(
          reading.synthesis,
        )
      ),
    no_deterministic_claim: !DETERMINISTIC_CLAIM_PATTERN.test(prose),
    final_integration:
      reading.reading_phase !== "final"
      || Boolean(reading.initial_reading_id),
  };
}

function cloneOptionsForRetry(
  options: ReadingGenerationCallOptions | undefined,
) {
  if (!options) return undefined;
  return {
    ...options,
    attempt: 2,
    kind: "retry" as const,
    attemptId: `${options.runId}:monolithic:2`,
  };
}

class MonolithicRetryProvider implements ReadingProvider {
  constructor(private readonly inner: ReadingProvider) {}

  private async retry<T>(
    operation: (options?: ReadingGenerationCallOptions) => Promise<T>,
    options?: ReadingGenerationCallOptions,
  ) {
    try {
      return await operation(options);
    } catch (error) {
      const retryable = isReadingGenerationError(error)
        ? error.retryable
        : isReadingServiceError(error) && error.code === "generation_failed";
      if (!retryable) throw error;
      return operation(cloneOptionsForRetry(options));
    }
  }

  generateInitialRead(
    context: HydratedReadingContext,
    options?: ReadingGenerationCallOptions,
  ) {
    return this.retry(
      (attempt) => this.inner.generateInitialRead(context, attempt),
      options,
    );
  }

  generateFinalRead(
    context: FinalReadingContext,
    options?: ReadingGenerationCallOptions,
  ) {
    return this.retry(
      (attempt) => this.inner.generateFinalRead(context, attempt),
      options,
    );
  }

  generateCompactRead(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<CompactReadingDraft> {
    return this.inner.generateCompactRead(context, options);
  }

  generateCardInsights(
    context: HydratedReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<CardInsightDraft[]> {
    return this.inner.generateCardInsights(context, options);
  }

  generateSynthesis(
    context: HydratedReadingContext,
    insights: CardInsightDraft[],
    options: ReadingGenerationCallOptions,
  ): Promise<SynthesisDraft> {
    return this.inner.generateSynthesis(context, insights, options);
  }

  refineFinalSynthesis(
    context: FinalReadingContext,
    options: ReadingGenerationCallOptions,
  ): Promise<FinalSynthesisDraft> {
    return this.inner.refineFinalSynthesis(context, options);
  }

  repairStage(
    request: RepairStageRequest,
    options: ReadingGenerationCallOptions,
  ): Promise<ReadingStageDraft> {
    return this.inner.repairStage(request, options);
  }
}

function buildPayload({
  spreadIndex,
  questionType,
  question,
  profile,
  scenarioIndex,
}: {
  spreadIndex: number;
  questionType: QuestionType;
  question: string;
  profile: AgentProfile;
  scenarioIndex: number;
}): ReadingRequestPayload {
  const spread = getAllSpreads()[spreadIndex];
  const deck = getAllCards();
  const cellIndex = spreadIndex * 5
    + Object.keys(QUESTION_FIXTURES).indexOf(questionType);
  return {
    request_id: randomUUID(),
    question,
    spreadId: spread.id,
    agent_profile: profile,
    phase: "initial",
    draw_source: "digital_random",
    drawnCards: spread.positions.map((position, cardIndex) => {
      const card = deck[(cellIndex * 17 + scenarioIndex * 7 + cardIndex * 11) % deck.length];
      return {
        positionId: position.id,
        cardId: card.id,
        isReversed: spread.id === "single"
          ? (cellIndex + scenarioIndex) % 2 === 1
          : (cellIndex + scenarioIndex + cardIndex) % 3 === 0,
      };
    }),
  };
}

async function runExecution({
  pairId,
  arm,
  scenario,
  payload,
  provider,
  initialReading,
}: {
  pairId: string;
  arm: Arm;
  scenario: Scenario;
  payload: ReadingRequestPayload;
  provider: ReadingProvider;
  initialReading?: StructuredReading;
}): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const executionId = `${pairId}:${arm}:${scenario}`;
  let rawCompletions: LlmRawCompletion[] = [];
  let calls: LlmCallMetric[] = [];
  try {
    const rawCollected = await collectLlmRawCompletions(() =>
      collectLlmUsage(() =>
        runReadingGraphWithDiagnostics(payload, {
          provider,
          generationMode: arm as ReadingGenerationMode,
          initialReading,
        })
      )
    );
    rawCompletions = rawCollected.completions;
    calls = rawCollected.result.calls;
    const reading = rawCollected.result.result.reading;
    return {
      execution_id: executionId,
      pair_id: pairId,
      arm,
      scenario,
      scored: scenario !== "sober_final_prep",
      duration_ms: Date.now() - startedAt,
      payload,
      reading,
      trace: rawCollected.result.result.trace,
      calls,
      usage: summarizeLlmCalls(calls),
      raw_completions: rawCompletions,
      checks: evaluateChecks(reading, payload),
      error: null,
    };
  } catch (rawError) {
    const rawUnwrapped = unwrapLlmRawCompletionError(rawError);
    rawCompletions = rawUnwrapped.completions;
    const usageUnwrapped = unwrapLlmUsageError(rawUnwrapped.cause);
    calls = usageUnwrapped.calls;
    const error = usageUnwrapped.cause;
    return {
      execution_id: executionId,
      pair_id: pairId,
      arm,
      scenario,
      scored: scenario !== "sober_final_prep",
      duration_ms: Date.now() - startedAt,
      payload,
      reading: null,
      trace: isReadingServiceError(error) ? error.diagnosticTrace ?? null : null,
      calls,
      usage: summarizeLlmCalls(calls),
      raw_completions: rawCompletions,
      checks: {},
      error: {
        code: isReadingServiceError(error) ? error.code : undefined,
        subtype: isReadingGenerationError(error) ? error.subtype : undefined,
        stage: isReadingGenerationError(error) ? error.stage : undefined,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function finalPayload(
  prepPayload: ReadingRequestPayload,
  initial: StructuredReading,
  questionType: QuestionType,
): ReadingRequestPayload {
  const answers: FollowupAnswer[] = initial.follow_up_questions.map((question) => ({
    question,
    answer: FOLLOWUP_ANSWERS[questionType],
  }));
  return {
    ...prepPayload,
    request_id: randomUUID(),
    phase: "final",
    initial_reading_id: initial.reading_id,
    followup_answers: answers,
  };
}

function fatalFailure(result: ExecutionResult) {
  return Boolean(
    result.error
    || Object.values(result.checks).some((passed) => !passed),
  );
}

function firstPassSuccess(result: ExecutionResult) {
  return (
    !fatalFailure(result)
    && result.calls.length > 0
    && result.calls.every((call) => call.success && call.attempt === 1)
  );
}

function percentile(values: number[], probability: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(probability * sorted.length) - 1),
  )];
}

function countBy<T>(values: T[], keyFor: (value: T) => string) {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizeUsage(results: ExecutionResult[]) {
  return {
    raw_requests: results.reduce((sum, result) => sum + result.calls.length, 0),
    prompt_tokens: results.reduce(
      (sum, result) => sum + result.usage.promptTokens,
      0,
    ),
    completion_tokens: results.reduce(
      (sum, result) => sum + result.usage.completionTokens,
      0,
    ),
    total_tokens: results.reduce(
      (sum, result) => sum + result.usage.totalTokens,
      0,
    ),
    estimated_cost_usd: results.reduce(
      (sum, result) => sum + result.usage.estimatedCostUsd,
      0,
    ),
  };
}

function summarizeLatencies(values: number[]) {
  return {
    p50_ms: percentile(values, 0.5),
    p95_ms: percentile(values, 0.95),
  };
}

function wilson(successes: number, total: number) {
  if (total === 0) return { observed: null, low: null, high: null };
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin = (
    z * Math.sqrt(
      (proportion * (1 - proportion)) / total
      + (z * z) / (4 * total * total),
    )
  ) / denominator;
  return {
    observed: proportion,
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function deterministicShuffle<T>(values: readonly T[], random: () => number) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function createHardBudgetTokenGate({
  tokenBudget,
  callLimit,
}: {
  tokenBudget: number;
  callLimit: number;
}) {
  const inner = createCanaryTokenGate({ tokenBudget, callLimit });
  const gate: LlmTokenGate = {
    async reserve(input) {
      const snapshot = inner.snapshot();
      if (snapshot.reservations >= callLimit) {
        throw new Error(`A/B reached the fixed ${callLimit}-request limit.`);
      }
      const worstCaseTokens = getReservationTokenCount(
        input.promptText,
        input.maxOutputTokens,
      );
      if (snapshot.settled_tokens + worstCaseTokens > tokenBudget) {
        throw new Error(
          `A/B cannot start another request without risking the ${tokenBudget}-token limit.`,
        );
      }
      return inner.gate.reserve(input);
    },
    settle(input) {
      return inner.gate.settle(input);
    },
  };
  return { gate, snapshot: inner.snapshot };
}

function bootstrapMeanDifference(pairs: Array<[number, number]>) {
  if (pairs.length === 0) return null;
  const random = createRandom(BOOTSTRAP_SEED);
  const differences: number[] = [];
  for (let sample = 0; sample < BOOTSTRAP_SAMPLES; sample += 1) {
    let total = 0;
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[Math.floor(random() * pairs.length)];
      total += pair[1] - pair[0];
    }
    differences.push(total / pairs.length);
  }
  differences.sort((left, right) => left - right);
  return {
    observed: pairs.reduce((sum, pair) => sum + pair[1] - pair[0], 0) / pairs.length,
    low: differences[Math.floor(differences.length * 0.025)],
    high: differences[Math.floor(differences.length * 0.975)],
  };
}

function parseRubric(payload: Record<string, unknown>) {
  const winner = payload.winner;
  const scores = payload.scores;
  if (
    winner !== "A"
    && winner !== "B"
    && winner !== "tie"
  ) {
    throw new ReadingGenerationError({
      subtype: "schema_violation",
      message: "rubric evaluator winner 无效。",
      retryable: false,
    });
  }
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new ReadingGenerationError({
      subtype: "schema_violation",
      message: "rubric evaluator scores 无效。",
      retryable: false,
    });
  }
  const normalizedScores: Record<string, { A: number; B: number }> = {};
  for (const dimension of RUBRIC_DIMENSIONS) {
    const value = (scores as Record<string, unknown>)[dimension];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ReadingGenerationError({
        subtype: "schema_violation",
        message: `rubric evaluator 缺少 ${dimension}。`,
        retryable: false,
      });
    }
    const A = Number((value as Record<string, unknown>).A);
    const B = Number((value as Record<string, unknown>).B);
    if (![A, B].every((score) => Number.isFinite(score) && score >= 1 && score <= 5)) {
      throw new ReadingGenerationError({
        subtype: "schema_violation",
        message: `rubric evaluator ${dimension} 分数无效。`,
        retryable: false,
      });
    }
    normalizedScores[dimension] = { A, B };
  }
  return {
    winner: winner as "A" | "B" | "tie",
    scores: normalizedScores,
    rationale: typeof payload.rationale === "string"
      ? payload.rationale.slice(0, 500)
      : "",
  };
}

async function evaluatePair({
  pairId,
  left,
  right,
  leftInitial,
  rightInitial,
  transport,
  swappedReview,
}: {
  pairId: string;
  left: ExecutionResult;
  right: ExecutionResult;
  leftInitial?: ExecutionResult;
  rightInitial?: ExecutionResult;
  transport: OpenAiCompatibleTransport;
  swappedReview: boolean;
}): Promise<RubricResult> {
  const labelOrder = swappedReview
    ? { A: right.arm, B: left.arm }
    : { A: left.arm, B: right.arm };
  const A = swappedReview ? right : left;
  const B = swappedReview ? left : right;
  const AInitial = swappedReview ? rightInitial : leftInitial;
  const BInitial = swappedReview ? leftInitial : rightInitial;
  const scoreShape = Object.fromEntries(
    RUBRIC_DIMENSIONS.map((dimension) => [dimension, { A: 1, B: 1 }]),
  );
  const payload = await transport.request({
    source: "reading",
    prompt: {
      system: [
        "You are an anonymous paired tarot-reading quality evaluator.",
        "Return JSON only with keys winner, scores, rationale.",
        "winner is A, B, or tie. scores contains every required dimension with integer A/B scores from 1 to 5.",
        `Dimensions: ${RUBRIC_DIMENSIONS.join(", ")}.`,
        `scores must use this exact nested object shape: ${JSON.stringify(scoreShape)}. Never return a single scalar score for a dimension.`,
        "Prioritize fatal contract, authority, grounding, safety, and contradiction failures before stylistic preference.",
        "Operational anchors: question_relevance measures whether the reading answers the shared question; spread_logic measures correct use of position semantics and spread axes; holistic_synthesis measures transformation into one argument rather than a card list; card_specificity measures concrete card-position-orientation use; constructive_tension measures a grounded counterpoint or unverified condition; card_synthesis_consistency measures whether synthesis faithfully consumes card interpretations without copying or contradicting them; final_integration measures whether a FINAL reading preserves the Initial axis and uses follow-up answers to narrow a relationship, tension, condition, or next action rather than merely appending an acknowledgement.",
        "Do not reward verbosity, answer order, source counts, grounding status, IDs, or metadata. Compare the visible prose and its use of the shared input.",
        "For INITIAL pairs, set final_integration to 5 for both A and B and do not use that dimension to choose the winner.",
      ].join("\n"),
      user: JSON.stringify({
        shared_input: {
          question: A.payload.question,
          spread_id: A.payload.spreadId,
          profile: A.payload.agent_profile,
          phase: A.payload.phase,
          drawn_cards: A.payload.drawnCards,
        },
        A: {
          initial: AInitial?.reading
            ? rubricReadingView(AInitial.reading)
            : undefined,
          followup_answers: A.payload.followup_answers,
          reading: A.reading ? rubricReadingView(A.reading) : null,
        },
        B: {
          initial: BInitial?.reading
            ? rubricReadingView(BInitial.reading)
            : undefined,
          followup_answers: B.payload.followup_answers,
          reading: B.reading ? rubricReadingView(B.reading) : null,
        },
      }),
    },
    maxOutputTokens: 1_200,
    parse: parseRubric,
    truncatedMessage: "rubric evaluator 输出被截断。",
    metric: {
      runId: `rubric:${pairId}`,
      stageId: `rubric:${pairId}`,
      attemptId: `rubric:${pairId}:${swappedReview ? "swap" : "primary"}`,
      stage: "rubric_evaluator",
      attempt: 1,
      kind: "generate",
    },
  });
  return {
    pair_id: pairId,
    label_order: labelOrder,
    winner: payload.winner,
    scores: payload.scores,
    rationale: payload.rationale,
    swapped_review: swappedReview,
  };
}

function buildSummary(
  executions: ExecutionResult[],
  rubricResults: RubricResult[],
) {
  const scored = executions.filter((item) => item.scored);
  const byArm = (arm: Arm) => scored.filter((item) => item.arm === arm);
  const paired = new Map<string, Partial<Record<Arm, ExecutionResult>>>();
  for (const result of scored) {
    const entry = paired.get(result.pair_id) ?? {};
    entry[result.arm] = result;
    paired.set(result.pair_id, entry);
  }
  const completePairs = [...paired.values()].filter(
    (pair): pair is Record<Arm, ExecutionResult> =>
      Boolean(pair.monolithic && pair.adaptive_staged),
  );
  const metrics = Object.fromEntries((["monolithic", "adaptive_staged"] as Arm[])
    .map((arm) => {
      const results = byArm(arm);
      const allArmResults = executions.filter((item) => item.arm === arm);
      const preparationResults = allArmResults.filter(
        (item) => item.scenario === "sober_final_prep",
      );
      const passed = results.filter((result) => !fatalFailure(result)).length;
      const firstPass = results.filter(firstPassSuccess).length;
      const attempts = results.map((result) => result.calls.length);
      const failedCalls = results.flatMap((result) =>
        result.calls.filter((call) => !call.success)
      );
      const recoveredFailedCalls = results
        .filter((result) => !fatalFailure(result))
        .flatMap((result) => result.calls.filter((call) => !call.success));
      const allCalls = allArmResults.flatMap((result) => result.calls);
      const stages = [...new Set(allCalls.map((call) => call.stage ?? "unknown"))];
      const scenarios = [...new Set(allArmResults.map((result) => result.scenario))];
      const checkNames = [...new Set(results.flatMap(
        (result) => Object.keys(result.checks),
      ))];
      return [arm, {
        scored_cases: results.length,
        legal_cases: passed,
        legal_rate: wilson(passed, results.length),
        first_pass_successes: firstPass,
        first_pass_rate: wilson(firstPass, results.length),
        recovered_cases: results.filter(
          (result) =>
            result.calls.some((call) => (call.attempt ?? 1) > 1)
            && !fatalFailure(result),
        ).length,
        p95_attempts: percentile(attempts, 0.95),
        ...summarizeUsage(results),
        all_execution_usage: summarizeUsage(allArmResults),
        final_preparation_usage: summarizeUsage(preparationResults),
        latency_p50_ms: percentile(results.map((result) => result.duration_ms), 0.5),
        latency_p95_ms: percentile(results.map((result) => result.duration_ms), 0.95),
        end_to_end_latency_by_scenario: Object.fromEntries(
          scenarios.map((scenario) => [
            scenario,
            summarizeLatencies(
              allArmResults
                .filter((result) => result.scenario === scenario)
                .map((result) => result.duration_ms),
            ),
          ]),
        ),
        stage_latency: Object.fromEntries(stages.map((stage) => [
          stage,
          summarizeLatencies(
            allCalls
              .filter((call) => (call.stage ?? "unknown") === stage)
              .map((call) => call.durationMs),
          ),
        ])),
        terminal_failures_by_stage_and_subtype: countBy(
          results.filter((result) => result.error),
          (result) =>
            `${result.error?.stage ?? "unknown"}:${result.error?.subtype ?? result.error?.code ?? "unknown"}`,
        ),
        failed_attempts_by_stage_and_subtype: countBy(
          failedCalls,
          (call) => `${call.stage ?? "unknown"}:${call.subtype ?? "unknown"}`,
        ),
        recovered_failed_attempts_by_stage_and_subtype: countBy(
          recoveredFailedCalls,
          (call) => `${call.stage ?? "unknown"}:${call.subtype ?? "unknown"}`,
        ),
        check_failures: Object.fromEntries(checkNames.map((name) => [
          name,
          results.filter((result) => result.checks[name] === false).length,
        ])),
      }];
    }));
  const primaryRubrics = rubricResults.filter((result) => !result.swapped_review);
  const resolvedPrimaryRubrics = primaryRubrics.filter((result) => !result.conflict);
  const wins = { monolithic: 0, adaptive_staged: 0, tie: 0 };
  for (const result of resolvedPrimaryRubrics) {
    if (result.winner === "tie") {
      wins.tie += 1;
    } else {
      wins[result.label_order[result.winner]] += 1;
    }
  }
  const rubricByDimension = Object.fromEntries(RUBRIC_DIMENSIONS.map((dimension) => {
    const pairs = resolvedPrimaryRubrics.map((result): [number, number] => {
      const monolithicLabel = result.label_order.A === "monolithic" ? "A" : "B";
      const adaptiveLabel = monolithicLabel === "A" ? "B" : "A";
      return [
        result.scores[dimension][monolithicLabel],
        result.scores[dimension][adaptiveLabel],
      ];
    });
    return [dimension, {
      monolithic_wins: pairs.filter(([baseline, adaptive]) => baseline > adaptive).length,
      adaptive_staged_wins: pairs.filter(
        ([baseline, adaptive]) => adaptive > baseline,
      ).length,
      ties: pairs.filter(([baseline, adaptive]) => baseline === adaptive).length,
      monolithic_mean: average(pairs.map(([baseline]) => baseline)),
      adaptive_staged_mean: average(pairs.map(([, adaptive]) => adaptive)),
      paired_bootstrap_difference: bootstrapMeanDifference(pairs),
    }];
  }));
  return {
    graph_executions: executions.length,
    scored_cases: scored.length,
    complete_pairs: completePairs.length,
    metrics,
    paired_differences: {
      total_tokens: bootstrapMeanDifference(completePairs.map((pair) => [
        pair.monolithic.usage.totalTokens,
        pair.adaptive_staged.usage.totalTokens,
      ])),
      latency_ms: bootstrapMeanDifference(completePairs.map((pair) => [
        pair.monolithic.duration_ms,
        pair.adaptive_staged.duration_ms,
      ])),
      fatal_rate: bootstrapMeanDifference(completePairs.map((pair) => [
        fatalFailure(pair.monolithic) ? 1 : 0,
        fatalFailure(pair.adaptive_staged) ? 1 : 0,
      ])),
    },
    paired_rubric: {
      ...wins,
      reviewed_pairs: primaryRubrics.length,
      resolved_pairs: resolvedPrimaryRubrics.length,
      swapped_rechecks: rubricResults.filter((result) => result.swapped_review).length,
      conflicts: rubricResults.filter(
        (result) => result.swapped_review && result.conflict,
      ).length,
      by_dimension: rubricByDimension,
    },
  };
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function rubricMean({
  results,
  arm,
  dimensions,
  pairFilter = () => true,
}: {
  results: RubricResult[];
  arm: Arm;
  dimensions: readonly (typeof RUBRIC_DIMENSIONS)[number][];
  pairFilter?: (pairId: string) => boolean;
}) {
  const values = results
    .filter((result) =>
      !result.swapped_review
      && !result.conflict
      && pairFilter(result.pair_id)
    )
    .flatMap((result) => {
      const label = result.label_order.A === arm ? "A" : "B";
      return dimensions.map((dimension) => result.scores[dimension]?.[label])
        .filter((value): value is number => typeof value === "number");
    });
  return average(values);
}

function buildEnablementGates(
  executions: ExecutionResult[],
  rubricResults: RubricResult[],
) {
  const scored = executions.filter((execution) => execution.scored);
  const byArm = (arm: Arm) =>
    scored.filter((execution) => execution.arm === arm);
  const baseline = byArm("monolithic");
  const adaptive = byArm("adaptive_staged");
  const initialStandard = (arm: Arm) =>
    byArm(arm).filter((execution) => execution.scenario === "standard_initial");
  const initialLite = (arm: Arm) =>
    byArm(arm).filter((execution) => execution.scenario === "lite_initial");
  const firstPassRate = (results: ExecutionResult[]) =>
    results.length > 0
      ? results.filter(firstPassSuccess).length / results.length
      : null;
  const averageTokens = (results: ExecutionResult[]) =>
    average(results.map((execution) => execution.usage.totalTokens));
  const latency = (results: ExecutionResult[], probability: number) =>
    percentile(results.map((execution) => execution.duration_ms), probability);
  const contradictionSignals = (results: ExecutionResult[]) =>
    results.filter(
      (execution) => execution.error?.subtype === "semantic_contradiction",
    ).length;
  const baselineContradictions = contradictionSignals(baseline);
  const adaptiveContradictions = contradictionSignals(adaptive);
  const primaryRubrics = rubricResults.filter((result) => !result.swapped_review);
  const baselineCardConsistency = rubricMean({
    results: rubricResults,
    arm: "monolithic",
    dimensions: ["card_synthesis_consistency"],
  });
  const adaptiveCardConsistency = rubricMean({
    results: rubricResults,
    arm: "adaptive_staged",
    dimensions: ["card_synthesis_consistency"],
  });
  const standardBaselineTokens = averageTokens(initialStandard("monolithic"));
  const standardAdaptiveTokens = averageTokens(initialStandard("adaptive_staged"));
  const liteBaselineP50 = latency(initialLite("monolithic"), 0.5);
  const liteAdaptiveP50 = latency(initialLite("adaptive_staged"), 0.5);
  const liteBaselineP95 = latency(initialLite("monolithic"), 0.95);
  const liteAdaptiveP95 = latency(initialLite("adaptive_staged"), 0.95);
  const rubricDimensions = {
    spread_logic: ["spread_logic"] as const,
    orientation_respect: ["orientation_respect"] as const,
    card_synthesis_consistency: ["card_synthesis_consistency"] as const,
    final_integration: ["final_integration"] as const,
    overall: RUBRIC_DIMENSIONS,
  };
  const rubricComparisons = Object.fromEntries(
    Object.entries(rubricDimensions).map(([name, dimensions]) => {
      const pairFilter = name === "final_integration"
        ? (pairId: string) => pairId.endsWith(":sober_final")
        : undefined;
      const monolithic = rubricMean({
        results: rubricResults,
        arm: "monolithic",
        dimensions,
        pairFilter,
      });
      const adaptiveStaged = rubricMean({
        results: rubricResults,
        arm: "adaptive_staged",
        dimensions,
        pairFilter,
      });
      return [name, {
        monolithic,
        adaptive_staged: adaptiveStaged,
        passed:
          monolithic !== null
          && adaptiveStaged !== null
          && adaptiveStaged >= monolithic,
      }];
    }),
  );
  const diagnosticFailures = adaptive.filter(
    (execution) =>
      execution.error
      && execution.error.code !== "token_limit_exceeded",
  );
  const adaptiveFatalCount = adaptive.filter(fatalFailure).length;
  const forbiddenFailures = adaptive.filter((execution) =>
    execution.error?.subtype === "safety_rejection"
    || execution.checks.authority === false
    || execution.checks.grounding === false
    || execution.checks.no_prose_leakage === false
    || execution.checks.no_deterministic_claim === false
  ).length;
  const baselineFirstPass = firstPassRate(baseline);
  const adaptiveFirstPass = firstPassRate(adaptive);
  const gates = {
    complete_matrix: {
      passed: executions.length === 200 && baseline.length === 75 && adaptive.length === 75,
      observed: {
        graph_executions: executions.length,
        monolithic_scored: baseline.length,
        adaptive_staged_scored: adaptive.length,
      },
      threshold: "200 Graph executions and 75 scored cases per arm",
    },
    adaptive_legal_rate: {
      passed: adaptive.length === 75 && adaptiveFatalCount === 0,
      observed: {
        legal: adaptive.length - adaptiveFatalCount,
        total: adaptive.length,
        wilson_95: wilson(adaptive.length - adaptiveFatalCount, adaptive.length),
      },
      threshold: "75/75 observed legal; report Wilson 95% CI without a 99.5% proof claim",
    },
    forbidden_fatals: {
      passed: forbiddenFailures === 0,
      observed: forbiddenFailures,
      threshold: "0 authority, grounding, leakage, safety, and deterministic-claim fatals",
    },
    first_pass_success: {
      passed:
        baselineFirstPass !== null
        && adaptiveFirstPass !== null
        && adaptiveFirstPass >= baselineFirstPass,
      observed: {
        monolithic: baselineFirstPass,
        adaptive_staged: adaptiveFirstPass,
      },
      threshold: "adaptive_staged >= monolithic",
    },
    failure_diagnostics: {
      passed: diagnosticFailures.every(
        (execution) =>
          Boolean(execution.error?.stage)
          && Boolean(execution.error?.subtype)
          && Boolean(execution.trace?.generation?.attempts.length),
      ),
      observed: {
        generation_failures: diagnosticFailures.length,
        missing_stage_attempt_subtype: diagnosticFailures.filter(
          (execution) =>
            !execution.error?.stage
            || !execution.error?.subtype
            || !execution.trace?.generation?.attempts.length,
        ).length,
      },
      threshold: "every generation failure has stage, attempt, and subtype",
    },
    contradiction_signal: {
      passed: baselineContradictions > 0
        ? adaptiveContradictions < baselineContradictions
        : (
          adaptiveContradictions === 0
          && baselineCardConsistency !== null
          && adaptiveCardConsistency !== null
          && adaptiveCardConsistency >= baselineCardConsistency
        ),
      observed: {
        monolithic_count: baselineContradictions,
        adaptive_staged_count: adaptiveContradictions,
        monolithic_card_consistency: baselineCardConsistency,
        adaptive_staged_card_consistency: adaptiveCardConsistency,
      },
      threshold:
        "fewer explicit contradictions; when baseline has none, no new signal and card-consistency rubric non-regression",
    },
    standard_average_tokens: {
      passed:
        standardBaselineTokens !== null
        && standardAdaptiveTokens !== null
        && standardAdaptiveTokens <= standardBaselineTokens * 1.35,
      observed: {
        monolithic: standardBaselineTokens,
        adaptive_staged: standardAdaptiveTokens,
      },
      threshold: "adaptive_staged <= monolithic * 1.35",
    },
    lite_latency_p50: {
      passed:
        liteBaselineP50 !== null
        && liteAdaptiveP50 !== null
        && liteAdaptiveP50 <= liteBaselineP50 * 1.1,
      observed: {
        monolithic_ms: liteBaselineP50,
        adaptive_staged_ms: liteAdaptiveP50,
      },
      threshold: "adaptive_staged <= monolithic * 1.10",
    },
    lite_latency_p95: {
      passed:
        liteBaselineP95 !== null
        && liteAdaptiveP95 !== null
        && liteAdaptiveP95 <= liteBaselineP95 * 1.2,
      observed: {
        monolithic_ms: liteBaselineP95,
        adaptive_staged_ms: liteAdaptiveP95,
      },
      threshold: "adaptive_staged <= monolithic * 1.20",
    },
    rubric_coverage_and_review: {
      passed:
        primaryRubrics.length === 75
        && rubricResults.filter((result) => result.swapped_review).length === 15
        && rubricResults.every((result) => !result.conflict),
      observed: {
        primary: primaryRubrics.length,
        swapped_rechecks: rubricResults.filter(
          (result) => result.swapped_review,
        ).length,
        unresolved_conflicts: rubricResults.filter(
          (result) => result.swapped_review && result.conflict,
        ).length,
      },
      threshold: "75 primary, 15 swapped rechecks, and 0 unresolved conflicts",
    },
    rubric_non_regression: {
      passed: Object.values(rubricComparisons).every(
        (comparison) => comparison.passed,
      ),
      observed: rubricComparisons,
      threshold:
        "spread, orientation, card/synthesis, Final integration, and overall means do not regress",
    },
  };
  return {
    passed: Object.values(gates).every((gate) => gate.passed),
    gates,
  };
}

function markdownSummary(report: {
  status: string;
  started_at: string;
  ended_at: string;
  model: string;
  summary: ReturnType<typeof buildSummary>;
  enablement: ReturnType<typeof buildEnablementGates>;
  budget: Record<string, number>;
  recommendation: string;
}) {
  return [
    "# Reading Agent 自适应分阶段真实 LLM A/B",
    "",
    `- 状态：${report.status}`,
    `- 时间：${report.started_at} → ${report.ended_at}`,
    `- 模型：${report.model}`,
    `- Graph executions：${report.summary.graph_executions}`,
    `- Scored pairs：${report.summary.complete_pairs}`,
    `- Raw requests：${report.budget.reservations}`,
    `- Settled tokens：${report.budget.settled_tokens}`,
    `- 启用门槛：${report.enablement.passed ? "全部通过" : "未全部通过"}`,
    `- 建议：${report.recommendation}`,
    "",
    "详细 Wilson 区间、paired bootstrap、stage/subtype、token、费用、延迟和 rubric 结果见 `summary.json` 与 `metrics.json`。",
    "",
  ].join("\n");
}

async function main() {
  await loadLocalEnv();
  if (process.env.AETHERTAROT_READING_PROVIDER !== "llm") {
    throw new Error("A/B requires AETHERTAROT_READING_PROVIDER=llm in .env.local.");
  }
  const config = resolveLlmProviderConfig(process.env);
  if (!config.apiKey) {
    throw new Error("A/B requires a configured LLM API key.");
  }

  const graphExecutionLimit = positiveIntegerEnv(
    "AETHERTAROT_AB_GRAPH_EXECUTION_LIMIT",
    GRAPH_EXECUTION_LIMIT,
  );
  const tokenBudget = positiveIntegerEnv(
    "AETHERTAROT_AB_TOKEN_BUDGET",
    TOKEN_BUDGET,
  );
  const rawRequestLimit = positiveIntegerEnv(
    "AETHERTAROT_AB_RAW_REQUEST_LIMIT",
    RAW_REQUEST_LIMIT,
  );
  const evaluatorTokenBudget = positiveIntegerEnv(
    "AETHERTAROT_AB_EVALUATOR_TOKEN_BUDGET",
    EVALUATOR_TOKEN_BUDGET,
  );
  const evaluatorRequestLimit = positiveIntegerEnv(
    "AETHERTAROT_AB_EVALUATOR_REQUEST_LIMIT",
    EVALUATOR_REQUEST_LIMIT,
  );
  const swapEvery = positiveIntegerEnv("AETHERTAROT_AB_SWAP_EVERY", 5);

  const startedAt = new Date().toISOString();
  const outputDirectory = path.join(
    OUTPUT_ROOT,
    `staged-reading-ab-${startedAt.replace(/[:.]/g, "-")}`,
  );
  await mkdir(outputDirectory, { recursive: true });
  const tokenGate = createHardBudgetTokenGate({
    tokenBudget,
    callLimit: rawRequestLimit,
  });
  const abTokenGate = {
    async reserve(input: Parameters<typeof tokenGate.gate.reserve>[0]) {
      try {
        return await tokenGate.gate.reserve(input);
      } catch (error) {
        throw new ReadingServiceError(
          "token_limit_exceeded",
          error instanceof Error ? error.message : "A/B hard budget exceeded.",
          429,
        );
      }
    },
    async settle(input: Parameters<typeof tokenGate.gate.settle>[0]) {
      try {
        await tokenGate.gate.settle(input);
      } catch (error) {
        throw new ReadingServiceError(
          "token_limit_exceeded",
          error instanceof Error ? error.message : "A/B hard budget exceeded.",
          429,
        );
      }
    },
  };
  const baseProvider = createLlmReadingProviderFromEnv(
    process.env,
    fetch,
    abTokenGate,
  );
  const providers: Record<Arm, ReadingProvider> = {
    monolithic: new MonolithicRetryProvider(baseProvider),
    adaptive_staged: baseProvider,
  };
  const executions: ExecutionResult[] = [];
  const allQuestionTypes = Object.keys(QUESTION_FIXTURES) as QuestionType[];
  const configuredQuestionTypes = process.env.AETHERTAROT_AB_QUESTION_TYPES
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const questionTypes = configuredQuestionTypes?.length
    ? configuredQuestionTypes.map((value) => {
        if (!allQuestionTypes.includes(value as QuestionType)) {
          throw new Error(`Unknown A/B question type: ${value}`);
        }
        return value as QuestionType;
      })
    : allQuestionTypes;
  const configuredArm = process.env.AETHERTAROT_AB_ONLY_ARM;
  if (
    configuredArm
    && configuredArm !== "monolithic"
    && configuredArm !== "adaptive_staged"
  ) {
    throw new Error(`Unknown A/B arm: ${configuredArm}`);
  }
  const onlyArm = configuredArm as Arm | undefined;
  const configuredPairIds = process.env.AETHERTAROT_AB_PAIR_IDS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const selectedPairIds = configuredPairIds?.length
    ? new Set(configuredPairIds)
    : undefined;
  const validPairIds = new Set(
    getAllSpreads().flatMap((spread) =>
      allQuestionTypes.flatMap((questionType) => [
        `${spread.id}:${questionType}:lite_initial`,
        `${spread.id}:${questionType}:standard_initial`,
        `${spread.id}:${questionType}:sober_final`,
      ])
    ),
  );
  for (const pairId of selectedPairIds ?? []) {
    if (!validPairIds.has(pairId)) {
      throw new Error(`Unknown A/B pair ID: ${pairId}`);
    }
  }
  const shouldRunPair = (pairId: string) =>
    selectedPairIds === undefined || selectedPairIds.has(pairId);
  const executionCountForCell = (spreadId: string, questionType: QuestionType) => {
    const prefix = `${spreadId}:${questionType}:`;
    return Number(shouldRunPair(`${prefix}lite_initial`))
      + Number(shouldRunPair(`${prefix}standard_initial`))
      + (shouldRunPair(`${prefix}sober_final`) ? 2 : 0);
  };
  const selectedArmCount = onlyArm ? 1 : 2;
  const plannedGraphExecutions = getAllSpreads().reduce(
    (total, spread) => total + questionTypes.reduce(
      (spreadTotal, questionType) =>
        spreadTotal + executionCountForCell(spread.id, questionType),
      0,
    ),
    0,
  ) * selectedArmCount;
  if (plannedGraphExecutions === 0) {
    throw new Error("A/B pair selection produced no Graph executions.");
  }
  if (plannedGraphExecutions > graphExecutionLimit) {
    throw new Error(
      `Planned matrix has ${plannedGraphExecutions} Graph executions, above the ${graphExecutionLimit} limit.`,
    );
  }
  const matrixRandom = createRandom(MATRIX_SEED);
  const cells = deterministicShuffle(
    getAllSpreads().flatMap((spread, spreadIndex) =>
      questionTypes
        .filter((questionType) =>
          executionCountForCell(spread.id, questionType) > 0
        )
        .map((questionType) => ({
          spreadIndex,
          questionType,
        }))
    ),
    matrixRandom,
  );
  let stoppedByBudget = false;

  outer:
  for (const { spreadIndex, questionType } of cells) {
    const arms: Arm[] = onlyArm
      ? [onlyArm]
      : matrixRandom() < 0.5
        ? ["monolithic", "adaptive_staged"]
        : ["adaptive_staged", "monolithic"];
    for (const arm of arms) {
      const spreadId = getAllSpreads()[spreadIndex].id;
      const scenarios = [
        {
          scenario: "lite_initial" as const,
          profile: "lite" as const,
          question: QUESTION_FIXTURES[questionType][0],
          scenarioIndex: 0,
        },
        {
          scenario: "standard_initial" as const,
          profile: "standard" as const,
          question: QUESTION_FIXTURES[questionType][1],
          scenarioIndex: 1,
        },
        {
          scenario: "sober_final_prep" as const,
          profile: "sober" as const,
          question: QUESTION_FIXTURES[questionType][2],
          scenarioIndex: 2,
        },
      ].filter((scenario) => {
        const scoredScenario = scenario.scenario.replace("_prep", "");
        return shouldRunPair(`${spreadId}:${questionType}:${scoredScenario}`);
      });
      let prep: ExecutionResult | undefined;
      for (const scenario of scenarios) {
        if (executions.length >= graphExecutionLimit) {
          stoppedByBudget = true;
          break outer;
        }
        const payload = buildPayload({
          spreadIndex,
          questionType,
          question: scenario.question,
          profile: scenario.profile,
          scenarioIndex: scenario.scenarioIndex,
        });
        const pairId = `${spreadId}:${questionType}:${scenario.scenario.replace("_prep", "")}`;
        const result = await runExecution({
          pairId,
          arm,
          scenario: scenario.scenario,
          payload,
          provider: providers[arm],
        });
        executions.push(result);
        if (scenario.scenario === "sober_final_prep") prep = result;
        process.stdout.write(
          `[${executions.length}/${plannedGraphExecutions}] ${result.execution_id} ${result.error ? `FAIL ${result.error.stage ?? ""}:${result.error.subtype ?? result.error.code ?? ""}` : "PASS"}\n`,
        );
        if (result.error?.code === "token_limit_exceeded") {
          stoppedByBudget = true;
          break outer;
        }
      }
      const finalPairId = `${spreadId}:${questionType}:sober_final`;
      if (!shouldRunPair(finalPairId) || !prep?.reading) continue;
      if (executions.length >= graphExecutionLimit) {
        stoppedByBudget = true;
        break outer;
      }
      const final = await runExecution({
        pairId: finalPairId,
        arm,
        scenario: "sober_final",
        payload: finalPayload(prep.payload, prep.reading, questionType),
        provider: providers[arm],
        initialReading: prep.reading,
      });
      executions.push(final);
      process.stdout.write(
        `[${executions.length}/${plannedGraphExecutions}] ${final.execution_id} ${final.error ? `FAIL ${final.error.stage ?? ""}:${final.error.subtype ?? final.error.code ?? ""}` : "PASS"}\n`,
      );
      if (final.error?.code === "token_limit_exceeded") {
        stoppedByBudget = true;
        break outer;
      }
    }
    await writeFile(
      path.join(outputDirectory, "checkpoint.json"),
      `${JSON.stringify({
        status: "running",
        completed_graph_executions: executions.length,
        budget: tokenGate.snapshot(),
      }, null, 2)}\n`,
      "utf8",
    );
  }

  const scoredPairs = new Map<string, Partial<Record<Arm, ExecutionResult>>>();
  for (const execution of executions.filter((item) => item.scored)) {
    const pair = scoredPairs.get(execution.pair_id) ?? {};
    pair[execution.arm] = execution;
    scoredPairs.set(execution.pair_id, pair);
  }
  const evaluatorTokenGate = createHardBudgetTokenGate({
    tokenBudget: evaluatorTokenBudget,
    callLimit: evaluatorRequestLimit,
  });
  const evaluatorAbTokenGate: LlmTokenGate = {
    async reserve(input) {
      try {
        return await evaluatorTokenGate.gate.reserve(input);
      } catch (error) {
        throw new ReadingServiceError(
          "token_limit_exceeded",
          error instanceof Error ? error.message : "Evaluator hard budget exceeded.",
          429,
        );
      }
    },
    async settle(input) {
      try {
        await evaluatorTokenGate.gate.settle(input);
      } catch (error) {
        throw new ReadingServiceError(
          "token_limit_exceeded",
          error instanceof Error ? error.message : "Evaluator hard budget exceeded.",
          429,
        );
      }
    },
  };
  const evaluatorTransport = new OpenAiCompatibleTransport(
    config,
    fetch,
    evaluatorAbTokenGate,
  );
  const rubricResults: RubricResult[] = [];
  const evaluatorCalls: LlmCallMetric[] = [];
  const evaluatorRawCompletions: Array<{
    pair_id: string;
    review: "primary" | "swap";
    completion: LlmRawCompletion;
  }> = [];
  const evaluatorFailures: Array<{
    pair_id: string;
    review: "primary" | "swap";
    code?: string;
    subtype?: string;
    message: string;
  }> = [];
  const collectEvaluation = async ({
    pairId,
    left,
    right,
    leftInitial,
    rightInitial,
    swappedReview,
  }: {
    pairId: string;
    left: ExecutionResult;
    right: ExecutionResult;
    leftInitial?: ExecutionResult;
    rightInitial?: ExecutionResult;
    swappedReview: boolean;
  }): Promise<
    | { result: RubricResult; error: null }
    | { result: null; error: unknown }
  > => {
    const review = swappedReview ? "swap" as const : "primary" as const;
    try {
      const rawCollected = await collectLlmRawCompletions(() =>
        collectLlmUsage(() => evaluatePair({
          pairId,
          left,
          right,
          leftInitial,
          rightInitial,
          transport: evaluatorTransport,
          swappedReview,
        }))
      );
      evaluatorCalls.push(...rawCollected.result.calls);
      evaluatorRawCompletions.push(...rawCollected.completions.map(
        (completion) => ({ pair_id: pairId, review, completion }),
      ));
      return { result: rawCollected.result.result, error: null };
    } catch (rawError) {
      const rawUnwrapped = unwrapLlmRawCompletionError(rawError);
      const usageUnwrapped = unwrapLlmUsageError(rawUnwrapped.cause);
      evaluatorCalls.push(...usageUnwrapped.calls);
      evaluatorRawCompletions.push(...rawUnwrapped.completions.map(
        (completion) => ({ pair_id: pairId, review, completion }),
      ));
      const error = usageUnwrapped.cause;
      evaluatorFailures.push({
        pair_id: pairId,
        review,
        code: isReadingServiceError(error) ? error.code : undefined,
        subtype: isReadingGenerationError(error) ? error.subtype : undefined,
        message: error instanceof Error ? error.message : String(error),
      });
      return { result: null, error };
    }
  };
  if (!stoppedByBudget && process.env.AETHERTAROT_AB_SKIP_EVALUATOR !== "1") {
    let pairIndex = 0;
    for (const [pairId, pair] of scoredPairs) {
      const monolithic = pair.monolithic;
      const adaptiveStaged = pair.adaptive_staged;
      if (!monolithic?.reading || !adaptiveStaged?.reading) continue;
      const monolithicInitial = monolithic.payload.phase === "final"
        ? executions.find((execution) =>
            execution.pair_id === pairId
            && execution.arm === "monolithic"
            && execution.scenario === "sober_final_prep"
            && Boolean(execution.reading)
          )
        : undefined;
      const adaptiveStagedInitial = adaptiveStaged.payload.phase === "final"
        ? executions.find((execution) =>
            execution.pair_id === pairId
            && execution.arm === "adaptive_staged"
            && execution.scenario === "sober_final_prep"
            && Boolean(execution.reading)
          )
        : undefined;
      const primaryCollected = await collectEvaluation({
        pairId,
        left: monolithic,
        right: adaptiveStaged,
        leftInitial: monolithicInitial,
        rightInitial: adaptiveStagedInitial,
        swappedReview: false,
      });
      if (primaryCollected.result === null) {
        if (
          isReadingServiceError(primaryCollected.error)
          && primaryCollected.error.code === "token_limit_exceeded"
        ) {
          stoppedByBudget = true;
          break;
        }
        pairIndex += 1;
        continue;
      }
      const primary = primaryCollected.result;
      rubricResults.push(primary);
      if (pairIndex % swapEvery === 0) {
        const swappedCollected = await collectEvaluation({
          pairId,
          left: monolithic,
          right: adaptiveStaged,
          leftInitial: monolithicInitial,
          rightInitial: adaptiveStagedInitial,
          swappedReview: true,
        });
        if (swappedCollected.result === null) {
          if (
            isReadingServiceError(swappedCollected.error)
            && swappedCollected.error.code === "token_limit_exceeded"
          ) {
            stoppedByBudget = true;
            break;
          }
          pairIndex += 1;
          continue;
        }
        const swapped = swappedCollected.result;
        const primaryWinner = primary.winner === "tie"
          ? "tie"
          : primary.label_order[primary.winner];
        const swappedWinner = swapped.winner === "tie"
          ? "tie"
          : swapped.label_order[swapped.winner];
        const conflict = primaryWinner !== swappedWinner;
        primary.conflict = conflict;
        swapped.conflict = conflict;
        rubricResults.push(swapped);
      }
      pairIndex += 1;
    }
  }

  const summary = buildSummary(executions, rubricResults);
  const summaryWithEvaluator = {
    ...summary,
    evaluator_usage: {
      raw_requests: evaluatorCalls.length,
      ...summarizeLlmCalls(evaluatorCalls),
    },
    evaluator_failures: evaluatorFailures,
  };
  const enablement = buildEnablementGates(executions, rubricResults);
  const recommendation = enablement.passed
    ? "全部预设门槛通过；建议在单独变更中配置启用 adaptive_staged。本脚本不会修改生产默认值。"
    : "继续保持 monolithic 默认；先根据 stage/subtype 与 paired 指标修正有证据支持的问题。";
  const endedAt = new Date().toISOString();
  const report = {
    version: 1,
    status:
      stoppedByBudget
      || executions.length < plannedGraphExecutions
      || evaluatorFailures.length > 0
        ? "partial"
        : "completed",
    started_at: startedAt,
    ended_at: endedAt,
    model: config.model,
    config: {
      generation_arms: ["monolithic", "adaptive_staged"],
      selected_arms: onlyArm ? [onlyArm] : ["monolithic", "adaptive_staged"],
      question_types: questionTypes,
      selected_pair_ids: selectedPairIds ? [...selectedPairIds] : null,
      swap_every: swapEvery,
      matrix_seed: MATRIX_SEED,
      temperature: config.temperature,
      thinking_mode: "disabled",
      response_format: "json_object",
      max_output_tokens: config.maxOutputTokens,
      seed_supported: false,
      api_key_configured: true,
      base_url_host: new URL(config.baseUrl).host,
      token_budget: tokenBudget,
      raw_request_limit: rawRequestLimit,
      graph_execution_limit: graphExecutionLimit,
      planned_graph_executions: plannedGraphExecutions,
      evaluator_token_budget: evaluatorTokenBudget,
      evaluator_request_limit: evaluatorRequestLimit,
      supabase_used: false,
    },
    summary: summaryWithEvaluator,
    enablement,
    budget: tokenGate.snapshot(),
    evaluator_budget: evaluatorTokenGate.snapshot(),
    recommendation,
  };
  const failures = executions.filter((execution) => fatalFailure(execution));
  const rawCompletionLines = executions.flatMap((execution) =>
    execution.raw_completions.map((completion) => JSON.stringify({
      execution_id: execution.execution_id,
      ...completion,
    }))
  );
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "summary.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "summary.md"),
      markdownSummary(report),
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "cases.jsonl"),
      `${executions.map((execution) => JSON.stringify(execution)).join("\n")}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "failures.json"),
      `${JSON.stringify(failures, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "metrics.json"),
      `${JSON.stringify(summaryWithEvaluator, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "config.redacted.json"),
      `${JSON.stringify(report.config, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "rubric.json"),
      `${JSON.stringify({
        dimensions: RUBRIC_DIMENSIONS,
        results: rubricResults,
        failures: evaluatorFailures,
      }, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "raw-completions.jsonl"),
      `${rawCompletionLines.join("\n")}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "rubric-raw-completions.jsonl"),
      `${
        evaluatorRawCompletions.map((item) => JSON.stringify(item)).join("\n")
      }\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "checkpoint.json"),
      `${JSON.stringify({
        status: report.status,
        completed_graph_executions: executions.length,
        budget: tokenGate.snapshot(),
      }, null, 2)}\n`,
      "utf8",
    ),
  ]);
  process.stdout.write(`A/B report: ${outputDirectory}\n`);
  process.stdout.write(`Recommendation: ${recommendation}\n`);
}

void main();
