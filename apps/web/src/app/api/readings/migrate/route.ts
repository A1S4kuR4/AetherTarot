import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import {
  requireBetaTesterAccess,
  type AuthenticatedTester,
} from "@/server/beta/access";
import { readBoundedJsonBody } from "@/server/http/json-body";
import { isReadingServiceError } from "@/server/reading/errors";
import { migrateStoredReadings } from "@/server/readings/stored-readings";

export const runtime = "nodejs";
const MAX_MIGRATE_REQUEST_BYTES = 2 * 1024 * 1024;

export interface MigrateRouteDependencies {
  requireAccess: () => Promise<AuthenticatedTester>;
  migrate: typeof migrateStoredReadings;
}

const DEFAULT_DEPS: MigrateRouteDependencies = {
  requireAccess: () => requireBetaTesterAccess(),
  migrate: migrateStoredReadings,
};

export async function handleMigratePost(
  request: Request,
  deps: MigrateRouteDependencies = DEFAULT_DEPS,
) {
  try {
    const tester = await deps.requireAccess();
    const payload = (await readBoundedJsonBody(
      request,
      MAX_MIGRATE_REQUEST_BYTES,
      "迁移记录",
    )) as ReadingHistoryEntry[];

    if (!Array.isArray(payload)) {
      return Response.json(
        { error: { code: "invalid_request", message: "请求体必须是数组。" } },
        { status: 400 },
      );
    }

    if (payload.length === 0) {
      return Response.json({ migrated: 0 });
    }

    const result = await deps.migrate(tester.userId, payload);

    if (result.error) {
      return Response.json(
        { error: { code: "server_error", message: "迁移记录失败。" } },
        { status: 500 },
      );
    }

    return Response.json({ migrated: result.migrated });
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

export async function POST(request: Request) {
  return handleMigratePost(request);
}
