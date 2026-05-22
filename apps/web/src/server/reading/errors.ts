import type { ReadingErrorCode } from "@aethertarot/shared-types";
import type { ReadingRunTrace } from "@/server/reading/trace";

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

export function isReadingServiceError(
  value: unknown,
): value is ReadingServiceError {
  return value instanceof ReadingServiceError;
}
