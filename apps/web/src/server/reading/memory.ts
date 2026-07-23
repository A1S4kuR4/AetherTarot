import "server-only";

import type { SessionMemory } from "@aethertarot/shared-types";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const sessionMemoryCardSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  orientation: z.enum(["upright", "reversed"]).optional(),
});

const sessionMemoryObjectSchema = z.object({
  thread_id: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  topics: z.array(z.string().trim().min(1)).default([]),
  cards: z.array(sessionMemoryCardSchema).default([]),
  stated_constraints: z.array(z.string().trim().min(1)).default([]),
  open_questions: z.array(z.string().trim().min(1)).default([]),
  last_advice_summary: z.string().trim().min(1).optional(),
  updated_at: z.string().datetime(),
});

export const sessionMemorySchema: z.ZodType<SessionMemory> =
  sessionMemoryObjectSchema;

export const sessionMemoryPatchSchema = sessionMemoryObjectSchema.partial();

export type SessionMemoryPatch = Partial<SessionMemory>;

export type SessionMemoryScope = {
  userId: string;
  threadId: string;
};
type SessionMemoryScopeInput = SessionMemoryScope | string;

export type SessionMemoryStore = {
  get(scope: SessionMemoryScopeInput): Promise<SessionMemory | null>;
  upsert(
    scope: SessionMemoryScopeInput,
    patch: SessionMemoryPatch,
  ): Promise<SessionMemory>;
  clear?(scope: SessionMemoryScopeInput): Promise<void>;
};

function uniqueStrings(values: string[] | undefined) {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function mergeStrings(left: string[] | undefined, right: string[] | undefined) {
  return uniqueStrings([...(left ?? []), ...(right ?? [])]);
}

function mergeCards(
  left: SessionMemory["cards"] | undefined,
  right: SessionMemory["cards"] | undefined,
) {
  const cardsByKey = new Map<string, SessionMemory["cards"][number]>();

  for (const card of [...(left ?? []), ...(right ?? [])]) {
    const key = `${card.id}:${card.orientation ?? "unknown"}`;
    cardsByKey.set(key, {
      ...cardsByKey.get(key),
      ...card,
    });
  }

  return [...cardsByKey.values()];
}

export function mergeSessionMemory(
  scope: SessionMemoryScope,
  existing: SessionMemory | null,
  patch: SessionMemoryPatch,
): SessionMemory {
  return sessionMemorySchema.parse({
    thread_id: scope.threadId,
    summary: patch.summary ?? existing?.summary,
    topics: mergeStrings(existing?.topics, patch.topics).slice(-12),
    cards: mergeCards(existing?.cards, patch.cards).slice(-20),
    stated_constraints: mergeStrings(
      existing?.stated_constraints,
      patch.stated_constraints,
    ).slice(-8),
    open_questions: patch.open_questions ?? existing?.open_questions ?? [],
    last_advice_summary:
      patch.last_advice_summary ?? existing?.last_advice_summary,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  });
}

export function createInMemorySessionMemoryStore(): SessionMemoryStore {
  const memoryByScope = new Map<string, SessionMemory>();
  const normalizeScope = (scope: SessionMemoryScopeInput): SessionMemoryScope =>
    typeof scope === "string"
      ? { userId: "test-user", threadId: scope }
      : scope;
  const getKey = (scope: SessionMemoryScopeInput) => {
    const normalized = normalizeScope(scope);
    return `${normalized.userId}:${normalized.threadId}`;
  };

  return {
    async get(scope) {
      return memoryByScope.get(getKey(scope)) ?? null;
    },

    async upsert(scope, patch) {
      const key = getKey(scope);
      const merged = mergeSessionMemory(
        normalizeScope(scope),
        memoryByScope.get(key) ?? null,
        patch,
      );

      memoryByScope.set(key, merged);
      return merged;
    },

    async clear(scope) {
      memoryByScope.delete(getKey(scope));
    },
  };
}

function requireAdminClient() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    throw new Error("persistent_store_unavailable");
  }
  return adminClient;
}

export function createSupabaseSessionMemoryStore(): SessionMemoryStore {
  return {
    async get(scope) {
      if (typeof scope === "string") {
        throw new Error("memory_scope_required");
      }
      const { data, error } = await requireAdminClient()
        .from("reading_thread_memories")
        .select("memory")
        .eq("user_id", scope.userId)
        .eq("thread_id", scope.threadId)
        .maybeSingle();

      if (error) {
        throw new Error(`memory_read_failed:${error.code}`);
      }

      return data ? sessionMemorySchema.parse(data.memory) : null;
    },

    async upsert(scope, patch) {
      if (typeof scope === "string") {
        throw new Error("memory_scope_required");
      }
      const { data, error } = await requireAdminClient().rpc(
        "merge_reading_thread_memory",
        {
          p_user_id: scope.userId,
          p_thread_id: scope.threadId,
          p_patch: patch as unknown as Json,
        },
      );

      if (error) {
        throw new Error(`memory_write_failed:${error.code}`);
      }

      const result = z
        .object({ memory: sessionMemorySchema })
        .parse(data);
      return result.memory;
    },

    async clear(scope) {
      if (typeof scope === "string") {
        throw new Error("memory_scope_required");
      }
      const { error } = await requireAdminClient()
        .from("reading_thread_memories")
        .delete()
        .eq("user_id", scope.userId)
        .eq("thread_id", scope.threadId);

      if (error) {
        throw new Error(`memory_delete_failed:${error.code}`);
      }
    },
  };
}

export const defaultSessionMemoryStore = createSupabaseSessionMemoryStore();
