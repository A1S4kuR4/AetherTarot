import "server-only";

import type { SessionMemory } from "@aethertarot/shared-types";
import { z } from "zod";

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

export type SessionMemoryStore = {
  get(threadId: string): Promise<SessionMemory | null>;
  upsert(threadId: string, patch: SessionMemoryPatch): Promise<SessionMemory>;
  clear?(threadId?: string): Promise<void>;
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

export function createInMemorySessionMemoryStore(): SessionMemoryStore {
  const memoryByThreadId = new Map<string, SessionMemory>();

  return {
    async get(threadId) {
      return memoryByThreadId.get(threadId) ?? null;
    },

    async upsert(threadId, patch) {
      const existing = memoryByThreadId.get(threadId);
      const updatedAt = patch.updated_at ?? new Date().toISOString();
      const merged = sessionMemorySchema.parse({
        thread_id: threadId,
        summary: patch.summary ?? existing?.summary,
        topics: mergeStrings(existing?.topics, patch.topics),
        cards: mergeCards(existing?.cards, patch.cards),
        stated_constraints: mergeStrings(
          existing?.stated_constraints,
          patch.stated_constraints,
        ),
        open_questions: mergeStrings(existing?.open_questions, patch.open_questions),
        last_advice_summary:
          patch.last_advice_summary ?? existing?.last_advice_summary,
        updated_at: updatedAt,
      });

      memoryByThreadId.set(threadId, merged);
      return merged;
    },

    async clear(threadId) {
      if (threadId) {
        memoryByThreadId.delete(threadId);
        return;
      }

      memoryByThreadId.clear();
    },
  };
}

export const defaultSessionMemoryStore = createInMemorySessionMemoryStore();
