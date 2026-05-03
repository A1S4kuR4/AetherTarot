import { ZodError } from "zod";
import type {
  EncyclopediaQueryRequest,
  ReadingErrorPayload,
} from "@aethertarot/shared-types";
import {
  E2E_ACCESS_BYPASS_HEADER,
  isE2eAccessBypassEnabled,
  requireBetaTesterAccess,
  type AuthenticatedTester,
} from "@/server/beta/access";
import { getClientIpHash } from "@/server/beta/ip";
import { consumeEncyclopediaQuota } from "@/server/beta/quota";
import { generateEncyclopediaAnswer } from "@/server/encyclopedia/service";
import { encyclopediaQueryRequestSchema } from "@/server/encyclopedia/schemas";
import { isReadingServiceError } from "@/server/reading/errors";
import {
  collectLlmUsage,
  summarizeLlmCalls,
  unwrapLlmUsageError,
  type LlmCallMetric,
} from "@/server/observability/llm-usage";
import {
  recordEncyclopediaEvent,
  type EncyclopediaEventInput,
} from "@/server/observability/encyclopedia-events";

export const runtime = "nodejs";

interface EncyclopediaRouteDependencies {
  getIpHash: (request: Request) => string;
  requireAccess: () => Promise<AuthenticatedTester>;
  consumeQuota: (input: {
    tester: AuthenticatedTester;
    ipHash: string;
  }) => Promise<void>;
  generateAnswer: typeof generateEncyclopediaAnswer;
  collectUsage: typeof collectLlmUsage;
  recordEvent: (input: EncyclopediaEventInput) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: EncyclopediaRouteDependencies = {
  getIpHash: getClientIpHash,
  requireAccess: () => requireBetaTesterAccess(),
  consumeQuota: consumeEncyclopediaQuota,
  generateAnswer: generateEncyclopediaAnswer,
  collectUsage: collectLlmUsage,
  recordEvent: recordEncyclopediaEvent,
};

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  const payload: ReadingErrorPayload = {
    error: {
      code,
      message,
      details,
    },
  };

  return Response.json(payload, { status });
}

function getEventBase({
  parsedPayload,
  tester,
  ipHash,
  startedAt,
}: {
  parsedPayload: EncyclopediaQueryRequest | null;
  tester: AuthenticatedTester | null;
  ipHash: string;
  startedAt: number;
}) {
  return {
    userId: tester?.userId ?? null,
    email: tester?.email ?? null,
    ipHash,
    provider: "encyclopedia-llm",
    query: parsedPayload?.query ?? null,
    cardId: parsedPayload?.cardId ?? null,
    durationMs: Date.now() - startedAt,
  };
}

export async function handleEncyclopediaQueryPost(
  request: Request,
  dependencies: Partial<EncyclopediaRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const startedAt = Date.now();
  const ipHash = deps.getIpHash(request);
  const shouldSkipBetaOps = isE2eAccessBypassEnabled(
    request.headers.get(E2E_ACCESS_BYPASS_HEADER),
  );
  let payload: unknown;
  let parsedPayload: EncyclopediaQueryRequest | null = null;
  let tester: AuthenticatedTester | null = null;

  const recordEvent = async (input: EncyclopediaEventInput) => {
    if (shouldSkipBetaOps) {
      return;
    }

    await deps.recordEvent(input);
  };

  try {
    payload = await request.json();
  } catch {
    await recordEvent({
      ...getEventBase({ parsedPayload, tester, ipHash, startedAt }),
      sourceCount: 0,
      status: "failure",
      errorCode: "invalid_request",
      llmDurationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    });
    return buildErrorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    parsedPayload = encyclopediaQueryRequestSchema.parse(payload);
    tester = await deps.requireAccess();
    await deps.consumeQuota({ tester, ipHash });
    const { result, calls } = await deps.collectUsage(() =>
      deps.generateAnswer(parsedPayload as EncyclopediaQueryRequest)
    );
    const usageSummary = summarizeLlmCalls(calls as LlmCallMetric[]);

    await recordEvent({
      ...getEventBase({ parsedPayload, tester, ipHash, startedAt }),
      sourceCount: result.sources.length,
      status: "success",
      errorCode: null,
      llmDurationMs: usageSummary.llmDurationMs,
      promptTokens: usageSummary.promptTokens,
      completionTokens: usageSummary.completionTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCostUsd: usageSummary.estimatedCostUsd,
    });

    return Response.json(result);
  } catch (error) {
    const unwrappedError = unwrapLlmUsageError(error);
    const usageSummary = summarizeLlmCalls(unwrappedError.calls);
    const actualError = unwrappedError.cause;

    const recordFailure = async (
      code: ReadingErrorPayload["error"]["code"],
    ) => {
      await recordEvent({
        ...getEventBase({ parsedPayload, tester, ipHash, startedAt }),
        sourceCount: 0,
        status: "failure",
        errorCode: code,
        llmDurationMs: usageSummary.llmDurationMs,
        promptTokens: usageSummary.promptTokens,
        completionTokens: usageSummary.completionTokens,
        totalTokens: usageSummary.totalTokens,
        estimatedCostUsd: usageSummary.estimatedCostUsd,
      });
    };

    if (actualError instanceof ZodError) {
      const firstIssue = actualError.issues[0]?.message ?? "请求参数无效。";
      await recordFailure("invalid_request");
      return buildErrorResponse("invalid_request", firstIssue, 400);
    }

    if (isReadingServiceError(actualError)) {
      await recordFailure(actualError.code);
      return buildErrorResponse(
        actualError.code,
        actualError.message,
        actualError.status,
        actualError.details,
      );
    }

    await recordFailure("generation_failed");
    return buildErrorResponse(
      "generation_failed",
      "百科问答生成失败，请稍后再试。",
      500,
    );
  }
}

export async function POST(request: Request) {
  return handleEncyclopediaQueryPost(request);
}
