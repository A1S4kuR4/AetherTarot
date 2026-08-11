import type { ReadingErrorCode } from "@aethertarot/shared-types";
import type { ReadingRunTrace } from "@/server/reading/trace";

export type ReadingGenerationFailureSubtype =
  | "transport_error"
  | "provider_http_error"
  | "timeout"
  | "response_too_large"
  | "queue_full"
  | "queue_timeout"
  | "truncated_output"
  | "empty_completion"
  | "malformed_json"
  | "schema_violation"
  | "authority_mismatch"
  | "prose_leakage"
  | "grounding_violation"
  | "semantic_contradiction"
  | "safety_rejection"
  | "retry_exhausted"
  | "cancelled";

export type ReadingGenerationStage =
  | "monolithic"
  | "compact"
  | "card_insights"
  | "synthesis"
  | "final_synthesis";

export interface ReadingGenerationAttempt {
  stage_id: string;
  attempt_id: string;
  stage: ReadingGenerationStage;
  attempt: number;
  kind: "generate" | "retry" | "repair";
  success: boolean;
  subtype?: ReadingGenerationFailureSubtype;
  duration_ms?: number;
  http_status?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
}

export class ReadingServiceError extends Error {
  code: ReadingErrorCode;
  status: number;
  intercept_reason?: string;
  referral_links?: string[];
  details?: Record<string, unknown>;
  diagnosticTrace?: ReadingRunTrace;

  constructor(
    code: ReadingErrorCode,
    message: string,
    status: number,
    intercept_reason?: string,
    referral_links?: string[],
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ReadingServiceError";
    this.code = code;
    this.status = status;
    this.intercept_reason = intercept_reason;
    this.referral_links = referral_links;
    this.details = details;
  }
}

export class ReadingGenerationError extends ReadingServiceError {
  subtype: ReadingGenerationFailureSubtype;
  stage?: ReadingGenerationStage;
  retryCauseSubtype?: ReadingGenerationFailureSubtype;
  retryable: boolean;
  invalidPayload?: unknown;
  issues: string[];
  attempts: ReadingGenerationAttempt[];
  httpStatus?: number;

  constructor({
    subtype,
    message,
    code,
    status,
    stage,
    retryCauseSubtype,
    retryable = false,
    invalidPayload,
    issues = [],
    attempts = [],
    httpStatus,
    details,
  }: {
    subtype: ReadingGenerationFailureSubtype;
    message: string;
    code?: ReadingErrorCode;
    status?: number;
    stage?: ReadingGenerationStage;
    retryCauseSubtype?: ReadingGenerationFailureSubtype;
    retryable?: boolean;
    invalidPayload?: unknown;
    issues?: string[];
    attempts?: ReadingGenerationAttempt[];
    httpStatus?: number;
    details?: Record<string, unknown>;
  }) {
    super(
      code ?? (
        subtype === "transport_error"
        || subtype === "provider_http_error"
        || subtype === "timeout"
          ? "provider_unavailable"
          : "generation_failed"
      ),
      message,
      status ?? (
        subtype === "transport_error"
        || subtype === "provider_http_error"
        || subtype === "timeout"
          ? 503
          : 500
      ),
      undefined,
      undefined,
      details,
    );
    this.name = "ReadingGenerationError";
    this.subtype = subtype;
    this.stage = stage;
    this.retryCauseSubtype = retryCauseSubtype;
    this.retryable = retryable;
    this.invalidPayload = invalidPayload;
    this.issues = issues;
    this.attempts = attempts;
    this.httpStatus = httpStatus;
  }
}

export function isReadingServiceError(
  value: unknown,
): value is ReadingServiceError {
  return value instanceof ReadingServiceError;
}

export function isReadingGenerationError(
  value: unknown,
): value is ReadingGenerationError {
  return value instanceof ReadingGenerationError;
}
