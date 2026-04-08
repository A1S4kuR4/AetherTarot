import type { ReadingErrorCode } from "@aethertarot/shared-types";

export class ReadingServiceError extends Error {
  code: ReadingErrorCode;
  status: number;

  constructor(code: ReadingErrorCode, message: string, status: number) {
    super(message);
    this.name = "ReadingServiceError";
    this.code = code;
    this.status = status;
  }
}

export function isReadingServiceError(
  value: unknown,
): value is ReadingServiceError {
  return value instanceof ReadingServiceError;
}
