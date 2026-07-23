import { requireBetaTesterAccess } from "@/server/beta/access";
import {
  createSupabaseSessionMemoryStore,
  type SessionMemoryStore,
} from "@/server/reading/memory";
import { isReadingServiceError } from "@/server/reading/errors";

export const runtime = "nodejs";

interface ThreadMemoryRouteDependencies {
  requireAccess: typeof requireBetaTesterAccess;
  memoryStore: SessionMemoryStore;
}

const DEFAULT_DEPENDENCIES: ThreadMemoryRouteDependencies = {
  requireAccess: requireBetaTesterAccess,
  memoryStore: createSupabaseSessionMemoryStore(),
};

export async function handleDeleteThreadMemory(
  threadId: string,
  dependencies: Partial<ThreadMemoryRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId || normalizedThreadId.length > 128) {
    return Response.json(
      { error: { code: "invalid_request", message: "threadId 无效。" } },
      { status: 400 },
    );
  }

  try {
    const actor = await deps.requireAccess();
    await deps.memoryStore.clear?.({
      userId: actor.userId,
      threadId: normalizedThreadId,
    });
    return Response.json({ deleted: true });
  } catch (error) {
    if (isReadingServiceError(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      {
        error: {
          code: "provider_unavailable",
          message: "暂时无法清除这条线的记忆，请稍后重试。",
        },
      },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await context.params;
  return handleDeleteThreadMemory(threadId);
}
