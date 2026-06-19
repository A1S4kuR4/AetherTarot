import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import {
  requireBetaTesterAccess,
  type AuthenticatedTester,
} from "@/server/beta/access";
import { readBoundedJsonBody } from "@/server/http/json-body";
import { isReadingServiceError } from "@/server/reading/errors";
import {
  saveStoredReading,
  listStoredReadings,
  updateStoredReadingNotes,
  DEFAULT_STORED_READINGS_LIMIT,
  MAX_STORED_READING_NOTES_LENGTH,
  normalizeStoredReadingsLimit,
} from "@/server/readings/stored-readings";

export const runtime = "nodejs";
const MAX_READINGS_REQUEST_BYTES = 256 * 1024;

export interface ReadingsRouteDependencies {
  requireAccess: () => Promise<AuthenticatedTester>;
  save: typeof saveStoredReading;
  list: typeof listStoredReadings;
  updateNotes: typeof updateStoredReadingNotes;
}

const DEFAULT_DEPS: ReadingsRouteDependencies = {
  requireAccess: () => requireBetaTesterAccess(),
  save: saveStoredReading,
  list: listStoredReadings,
  updateNotes: updateStoredReadingNotes,
};

function invalidRequest(message: string) {
  return Response.json(
    { error: { code: "invalid_request", message } },
    { status: 400 },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStoredReadingPayload(value: unknown): value is ReadingHistoryEntry {
  if (!isObject(value)) {
    return false;
  }

  const reading = value.reading;

  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.createdAt)
    && isNonEmptyString(value.spreadId)
    && Array.isArray(value.drawnCards)
    && isObject(reading)
    && isNonEmptyString(reading.reading_id)
    && reading.reading_id === value.id
  );
}

function parseLimitFromRequest(request: Request | null) {
  if (!request) {
    return DEFAULT_STORED_READINGS_LIMIT;
  }

  const rawLimit = new URL(request.url).searchParams.get("limit");

  if (rawLimit === null) {
    return DEFAULT_STORED_READINGS_LIMIT;
  }

  const parsedLimit = Number(rawLimit);
  return normalizeStoredReadingsLimit(parsedLimit);
}

export async function handleReadingsGet(
  requestOrDeps: Request | ReadingsRouteDependencies = DEFAULT_DEPS,
  maybeDeps?: ReadingsRouteDependencies,
) {
  const request = requestOrDeps instanceof Request ? requestOrDeps : null;
  const deps = requestOrDeps instanceof Request
    ? maybeDeps ?? DEFAULT_DEPS
    : requestOrDeps;

  try {
    const tester = await deps.requireAccess();
    const result = await deps.list(tester.userId, {
      limit: parseLimitFromRequest(request),
    });

    if (result.error) {
      return Response.json(
        { error: { code: "server_error", message: "读取记录失败。" } },
        { status: 500 },
      );
    }

    return Response.json({ readings: result.data });
  } catch (error) {
    if (isReadingServiceError(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "server_error", message: "服务器内部错误。" } },
      { status: 500 },
    );
  }
}

export async function handleReadingsPost(
  request: Request,
  deps: ReadingsRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const payload = (await readBoundedJsonBody(
      request,
      MAX_READINGS_REQUEST_BYTES,
      "保存记录",
    )) as unknown;

    if (!isStoredReadingPayload(payload)) {
      return invalidRequest("记录数据不完整。");
    }

    const result = await deps.save(tester.userId, payload);

    if (result.error) {
      return Response.json(
        { error: { code: "server_error", message: "保存记录失败。" } },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (isReadingServiceError(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "server_error", message: "服务器内部错误。" } },
      { status: 500 },
    );
  }
}

export async function handleReadingsPatch(
  request: Request,
  deps: ReadingsRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const payload = (await readBoundedJsonBody(
      request,
      MAX_READINGS_REQUEST_BYTES,
      "更新笔记",
    )) as unknown;

    if (!isObject(payload) || !isNonEmptyString(payload.reading_id)) {
      return invalidRequest("缺少 reading_id。");
    }

    const readingId = payload.reading_id;

    if (
      "user_notes" in payload
      && typeof payload.user_notes !== "string"
      && payload.user_notes !== undefined
    ) {
      return invalidRequest("笔记必须是字符串。");
    }

    const userNotes = typeof payload.user_notes === "string"
      ? payload.user_notes
      : "";

    if (userNotes.length > MAX_STORED_READING_NOTES_LENGTH) {
      return invalidRequest("笔记长度不能超过 2000 字。");
    }

    const result = await deps.updateNotes(
      tester.userId,
      readingId,
      userNotes,
    );

    if (result.error) {
      return Response.json(
        { error: { code: "server_error", message: "更新笔记失败。" } },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (isReadingServiceError(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "server_error", message: "服务器内部错误。" } },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleReadingsGet(request);
}

export async function POST(request: Request) {
  return handleReadingsPost(request);
}

export async function PATCH(request: Request) {
  return handleReadingsPatch(request);
}
