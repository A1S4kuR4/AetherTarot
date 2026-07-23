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
  skipped: z.boolean().optional(),
  reason: z.enum(["no_user_scope"]).optional(),
});

export type GetSessionMemoryInput = z.infer<typeof getSessionMemoryInputSchema>;
export type GetSessionMemoryOutput = z.infer<typeof getSessionMemoryOutputSchema>;

export const writeSessionMemoryInputSchema = z.object({
  threadId: z.string().trim().min(1),
  patch: sessionMemoryPatchSchema,
});

export const writeSessionMemoryOutputSchema = z.object({
  memory: sessionMemorySchema.nullable(),
  updated: z.boolean(),
  skipped: z.boolean().optional(),
  reason: z.enum(["no_user_scope"]).optional(),
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
  timeoutMs: 1_500,
  traceable: true,
  async run(input, context) {
    const store = context.sessionMemoryStore ?? defaultSessionMemoryStore;
    const userId = context.userId
      ?? (
        context.sessionMemoryStore && process.env.NODE_ENV !== "production"
          ? "test-user"
          : undefined
      );
    if (!userId) {
      return {
        memory: null,
        skipped: true,
        reason: "no_user_scope",
      };
    }

    return {
      memory: await store.get({
        userId,
        threadId: input.threadId,
      }),
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
  timeoutMs: 1_500,
  traceable: true,
  async run(input, context) {
    const store = context.sessionMemoryStore ?? defaultSessionMemoryStore;
    const userId = context.userId
      ?? (
        context.sessionMemoryStore && process.env.NODE_ENV !== "production"
          ? "test-user"
          : undefined
      );
    if (!userId) {
      return {
        memory: null,
        updated: false,
        skipped: true,
        reason: "no_user_scope",
      };
    }
    const memory = await store.upsert({
      userId,
      threadId: input.threadId,
    }, {
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
