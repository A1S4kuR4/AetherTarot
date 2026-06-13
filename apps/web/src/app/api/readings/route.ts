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
} from "@/server/readings/stored-readings";

export const runtime = "nodejs";
const MAX_READINGS_REQUEST_BYTES = 256 * 1024;

interface ReadingsRouteDependencies {
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

export async function GET(
  _request: Request,
  deps: ReadingsRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const result = await deps.list(tester.userId);

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

export async function POST(
  request: Request,
  deps: ReadingsRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const payload = (await readBoundedJsonBody(
      request,
      MAX_READINGS_REQUEST_BYTES,
      "保存记录",
    )) as ReadingHistoryEntry;

    if (!payload?.id || !payload?.reading || !payload?.spreadId) {
      return Response.json(
        { error: { code: "invalid_request", message: "记录数据不完整。" } },
        { status: 400 },
      );
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

export async function PATCH(
  request: Request,
  deps: ReadingsRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const payload = (await readBoundedJsonBody(
      request,
      MAX_READINGS_REQUEST_BYTES,
      "更新笔记",
    )) as { reading_id?: string; user_notes?: string };

    if (!payload?.reading_id) {
      return Response.json(
        { error: { code: "invalid_request", message: "缺少 reading_id。" } },
        { status: 400 },
      );
    }

    const result = await deps.updateNotes(
      tester.userId,
      payload.reading_id,
      payload.user_notes ?? "",
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
