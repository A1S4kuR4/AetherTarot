import "server-only";

import type { SessionMemory } from "@aethertarot/shared-types";
import { z } from "zod";
import {
  defaultSessionMemoryStore,
  sessionMemoryPatchSchema,
  sessionMemorySchema,
} from "@/server/reading/memory";
import type { ReadingToolDefinition } from "@/server/reading/tools/types";

export const getSessionMemoryInputSchema = z.object({
  threadId: z.string().trim().min(1),
});

export const getSessionMemoryOutputSchema = z.object({
  memory: sessionMemorySchema.nullable(),
});

export type GetSessionMemoryInput = z.infer<typeof getSessionMemoryInputSchema>;
export type GetSessionMemoryOutput = z.infer<typeof getSessionMemoryOutputSchema>;

export const writeSessionMemoryInputSchema = z.object({
  threadId: z.string().trim().min(1),
  patch: sessionMemoryPatchSchema,
});

export const writeSessionMemoryOutputSchema = z.object({
  memory: sessionMemorySchema,
  updated: z.boolean(),
});

export type WriteSessionMemoryInput = {
  threadId: string;
  patch: Partial<SessionMemory>;
};
export type WriteSessionMemoryOutput = z.infer<typeof writeSessionMemoryOutputSchema>;

export const getSessionMemoryTool: ReadingToolDefinition<
  GetSessionMemoryInput,
  GetSessionMemoryOutput
> = {
  name: "get_session_memory",
  description:
    "Read structured short-term memory scoped to the current reading thread.",
  permission: "session",
  riskLevel: "medium",
  inputSchema: getSessionMemoryInputSchema,
  outputSchema: getSessionMemoryOutputSchema,
  timeoutMs: 500,
  traceable: true,
  async run(input, context) {
    const store = context.sessionMemoryStore ?? defaultSessionMemoryStore;

    return {
      memory: await store.get(input.threadId),
    };
  },
};

export const writeSessionMemoryTool: ReadingToolDefinition<
  WriteSessionMemoryInput,
  WriteSessionMemoryOutput
> = {
  name: "write_session_memory",
  description:
    "Write structured short-term memory scoped to the current reading thread.",
  permission: "session",
  riskLevel: "medium",
  inputSchema: writeSessionMemoryInputSchema,
  outputSchema: writeSessionMemoryOutputSchema,
  timeoutMs: 500,
  traceable: true,
  async run(input, context) {
    const store = context.sessionMemoryStore ?? defaultSessionMemoryStore;
    const memory = await store.upsert(input.threadId, {
      ...input.patch,
      thread_id: input.threadId,
      updated_at: input.patch.updated_at ?? context.now ?? new Date().toISOString(),
    });

    return {
      memory,
      updated: true,
    };
  },
};
