import "server-only";

import type {
  AgentProfile,
  DrawSource,
  ReadingRequestCardInput,
  StructuredReading,
} from "@aethertarot/shared-types";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  apiAgentProfileSchema,
  drawSourceSchema,
  readingRequestCardInputSchema,
  structuredReadingSchema,
} from "@/server/reading/schemas";

export const READING_EXECUTION_LEASE_SECONDS = 180;
export const READING_EXECUTION_WAIT_MS = 125_000;
const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export function getReadingSubjectKey(input: {
  userId: string | null;
  email: string | null;
  ipHash: string;
}) {
  return input.userId ?? input.email ?? `anonymous:${input.ipHash}`;
}

export interface InitialReadingSnapshot {
  subjectKey: string;
  initialReadingId: string;
  requestId: string;
  question: string;
  spreadId: string;
  drawnCards: ReadingRequestCardInput[];
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  threadId: string | null;
  continuityContext: string | null;
  initialReading: StructuredReading;
  followUpQuestions: string[];
  expiresAt: string;
}

const initialSnapshotRowSchema = z.object({
  subject_key: z.string().min(1),
  initial_reading_id: z.string().min(1),
  request_id: z.string().uuid(),
  question: z.string().min(1),
  spread_id: z.string().min(1),
  drawn_cards: z.array(readingRequestCardInputSchema),
  profile: apiAgentProfileSchema,
  draw_source: drawSourceSchema,
  thread_id: z.string().nullable(),
  continuity_context: z.string().nullable(),
  initial_reading: structuredReadingSchema,
  follow_up_questions: z.array(z.string().min(1)),
  expires_at: z.string().datetime({ offset: true }),
});

function parseInitialSnapshot(value: unknown): InitialReadingSnapshot {
  const row = initialSnapshotRowSchema.parse(value);
  return {
    subjectKey: row.subject_key,
    initialReadingId: row.initial_reading_id,
    requestId: row.request_id,
    question: row.question,
    spreadId: row.spread_id,
    drawnCards: row.drawn_cards,
    agentProfile: row.profile,
    drawSource: row.draw_source,
    threadId: row.thread_id,
    continuityContext: row.continuity_context,
    initialReading: row.initial_reading,
    followUpQuestions: row.follow_up_questions,
    expiresAt: row.expires_at,
  };
}

export type InitialSnapshotClaim =
  | { status: "claimed"; snapshot: InitialReadingSnapshot }
  | { status: "missing" | "expired" | "busy" };

export interface InitialReadingSnapshotStore {
  save(
    snapshot: Omit<InitialReadingSnapshot, "expiresAt">,
  ): Promise<InitialReadingSnapshot>;
  claim(input: {
    subjectKey: string;
    initialReadingId: string;
    requestId: string;
  }): Promise<InitialSnapshotClaim>;
  release(input: {
    subjectKey: string;
    initialReadingId: string;
    requestId: string;
  }): Promise<void>;
  consume(input: {
    subjectKey: string;
    initialReadingId: string;
    requestId: string;
  }): Promise<void>;
}

export type ReadingExecutionReplay = {
  status: number;
  payload: StructuredReading | object;
};

export type ReadingExecutionClaim =
  | { status: "owner"; leaseOwner: string }
  | { status: "replay"; response: ReadingExecutionReplay }
  | { status: "wait" }
  | { status: "conflict" };

export interface ReadingRequestExecutionStore {
  claim(input: {
    subjectKey: string;
    requestId: string;
    payloadHash: string;
  }): Promise<ReadingExecutionClaim>;
  waitForResult(input: {
    subjectKey: string;
    requestId: string;
    payloadHash: string;
  }): Promise<ReadingExecutionClaim>;
  complete(input: {
    subjectKey: string;
    requestId: string;
    leaseOwner: string;
    response: ReadingExecutionReplay;
  }): Promise<void>;
  release(input: {
    subjectKey: string;
    requestId: string;
    leaseOwner: string;
  }): Promise<void>;
}

function requireAdminClient() {
  const client = createAdminClient();
  if (!client) {
    throw new Error("persistent_store_unavailable");
  }
  return client;
}

export function createSupabaseInitialReadingSnapshotStore():
InitialReadingSnapshotStore {
  return {
    async save(snapshot) {
      const expiresAt = new Date(Date.now() + SNAPSHOT_RETENTION_MS).toISOString();
      const { data, error } = await requireAdminClient()
        .from("reading_initial_snapshots")
        .upsert({
          subject_key: snapshot.subjectKey,
          initial_reading_id: snapshot.initialReadingId,
          request_id: snapshot.requestId,
          question: snapshot.question,
          spread_id: snapshot.spreadId,
          drawn_cards: snapshot.drawnCards as unknown as Json,
          profile: snapshot.agentProfile,
          draw_source: snapshot.drawSource,
          thread_id: snapshot.threadId,
          continuity_context: snapshot.continuityContext,
          initial_reading: snapshot.initialReading as unknown as Json,
          follow_up_questions: snapshot.followUpQuestions,
          expires_at: expiresAt,
        }, { onConflict: "subject_key,initial_reading_id" })
        .select("*")
        .single();

      if (error) {
        throw new Error(`initial_snapshot_save_failed:${error.code}`);
      }

      return parseInitialSnapshot(data);
    },

    async claim(input) {
      const { data, error } = await requireAdminClient().rpc(
        "claim_reading_initial_snapshot",
        {
          p_subject_key: input.subjectKey,
          p_initial_reading_id: input.initialReadingId,
          p_request_id: input.requestId,
          p_lease_seconds: READING_EXECUTION_LEASE_SECONDS,
        },
      );
      if (error) {
        throw new Error(`initial_snapshot_claim_failed:${error.code}`);
      }
      const result = z
        .object({
          status: z.enum(["claimed", "missing", "expired", "busy"]),
          snapshot: z.unknown().optional(),
        })
        .parse(data);
      return result.status === "claimed"
        ? { status: "claimed", snapshot: parseInitialSnapshot(result.snapshot) }
        : { status: result.status };
    },

    async release(input) {
      const { error } = await requireAdminClient().rpc(
        "release_reading_initial_snapshot",
        {
          p_subject_key: input.subjectKey,
          p_initial_reading_id: input.initialReadingId,
          p_request_id: input.requestId,
        },
      );
      if (error) {
        throw new Error(`initial_snapshot_release_failed:${error.code}`);
      }
    },

    async consume(input) {
      const { error } = await requireAdminClient().rpc(
        "consume_reading_initial_snapshot",
        {
          p_subject_key: input.subjectKey,
          p_initial_reading_id: input.initialReadingId,
          p_request_id: input.requestId,
        },
      );
      if (error) {
        throw new Error(`initial_snapshot_consume_failed:${error.code}`);
      }
    },
  };
}

function parseExecutionClaim(data: unknown, leaseOwner: string): ReadingExecutionClaim {
  const parsed = z
    .object({
      status: z.enum(["owner", "replay", "wait", "conflict"]),
      response_status: z.number().int().optional(),
      response_payload: z.unknown().optional(),
    })
    .parse(data);
  if (parsed.status === "owner") {
    return { status: "owner", leaseOwner };
  }
  if (parsed.status === "replay") {
    return {
      status: "replay",
      response: {
        status: parsed.response_status ?? 200,
        payload: parsed.response_payload as ReadingExecutionReplay["payload"],
      },
    };
  }
  return { status: parsed.status };
}

export function createSupabaseReadingRequestExecutionStore():
ReadingRequestExecutionStore {
  const claim = async (input: {
    subjectKey: string;
    requestId: string;
    payloadHash: string;
  }) => {
    const leaseOwner = crypto.randomUUID();
    const { data, error } = await requireAdminClient().rpc(
      "claim_reading_request_execution",
      {
        p_subject_key: input.subjectKey,
        p_request_id: input.requestId,
        p_payload_hash: input.payloadHash,
        p_lease_owner: leaseOwner,
        p_lease_seconds: READING_EXECUTION_LEASE_SECONDS,
      },
    );
    if (error) {
      throw new Error(`execution_claim_failed:${error.code}`);
    }
    return parseExecutionClaim(data, leaseOwner);
  };

  return {
    claim,

    async waitForResult(input) {
      const deadline = Date.now() + READING_EXECUTION_WAIT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const result = await claim(input);
        if (result.status !== "wait") {
          return result;
        }
      }
      return { status: "wait" };
    },

    async complete(input) {
      const { data, error } = await requireAdminClient().rpc(
        "complete_reading_request_execution",
        {
          p_subject_key: input.subjectKey,
          p_request_id: input.requestId,
          p_lease_owner: input.leaseOwner,
          p_response_status: input.response.status,
          p_response_payload: input.response.payload as unknown as Json,
        },
      );
      if (error || data !== true) {
        throw new Error(`execution_complete_failed:${error?.code ?? "lease_lost"}`);
      }
    },

    async release(input) {
      const { error } = await requireAdminClient().rpc(
        "release_reading_request_execution",
        {
          p_subject_key: input.subjectKey,
          p_request_id: input.requestId,
          p_lease_owner: input.leaseOwner,
        },
      );
      if (error) {
        throw new Error(`execution_release_failed:${error.code}`);
      }
    },
  };
}

type InMemoryExecution = {
  payloadHash: string;
  leaseOwner: string;
  leaseExpiresAt: number;
  response?: ReadingExecutionReplay;
};

export function createInMemoryReadingRuntimeStores(): {
  executionStore: ReadingRequestExecutionStore;
  snapshotStore: InitialReadingSnapshotStore;
} {
  const executions = new Map<string, InMemoryExecution>();
  const snapshots = new Map<
    string,
    InitialReadingSnapshot & {
      claimRequestId?: string;
      claimExpiresAt?: number;
    }
  >();
  const executionKey = (subjectKey: string, requestId: string) =>
    `${subjectKey}:${requestId}`;
  const snapshotKey = (subjectKey: string, initialReadingId: string) =>
    `${subjectKey}:${initialReadingId}`;

  const executionStore: ReadingRequestExecutionStore = {
    async claim(input) {
      const key = executionKey(input.subjectKey, input.requestId);
      const existing = executions.get(key);
      if (existing?.payloadHash !== undefined && existing.payloadHash !== input.payloadHash) {
        return { status: "conflict" };
      }
      if (existing?.response) {
        return { status: "replay", response: existing.response };
      }
      if (existing && existing.leaseExpiresAt > Date.now()) {
        return { status: "wait" };
      }
      const leaseOwner = crypto.randomUUID();
      executions.set(key, {
        payloadHash: input.payloadHash,
        leaseOwner,
        leaseExpiresAt: Date.now() + READING_EXECUTION_LEASE_SECONDS * 1_000,
      });
      return { status: "owner", leaseOwner };
    },
    async waitForResult(input) {
      const deadline = Date.now() + READING_EXECUTION_WAIT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const existing = executions.get(
          executionKey(input.subjectKey, input.requestId),
        );
        if (!existing) {
          return executionStore.claim(input);
        }
        if (existing.payloadHash !== input.payloadHash) {
          return { status: "conflict" };
        }
        if (existing.response) {
          return { status: "replay", response: existing.response };
        }
      }
      return { status: "wait" };
    },
    async complete(input) {
      const key = executionKey(input.subjectKey, input.requestId);
      const existing = executions.get(key);
      if (!existing || existing.leaseOwner !== input.leaseOwner) {
        throw new Error("execution_complete_failed:lease_lost");
      }
      executions.set(key, { ...existing, response: input.response });
    },
    async release(input) {
      const key = executionKey(input.subjectKey, input.requestId);
      if (executions.get(key)?.leaseOwner === input.leaseOwner) {
        executions.delete(key);
      }
    },
  };

  const snapshotStore: InitialReadingSnapshotStore = {
    async save(snapshot) {
      const stored = {
        ...snapshot,
        expiresAt: new Date(Date.now() + SNAPSHOT_RETENTION_MS).toISOString(),
      };
      snapshots.set(
        snapshotKey(snapshot.subjectKey, snapshot.initialReadingId),
        stored,
      );
      return stored;
    },
    async claim(input) {
      const key = snapshotKey(input.subjectKey, input.initialReadingId);
      const snapshot = snapshots.get(key);
      if (!snapshot) {
        return { status: "missing" };
      }
      if (Date.parse(snapshot.expiresAt) <= Date.now()) {
        snapshots.delete(key);
        return { status: "expired" };
      }
      if (
        snapshot.claimRequestId
        && snapshot.claimRequestId !== input.requestId
        && (snapshot.claimExpiresAt ?? 0) > Date.now()
      ) {
        return { status: "busy" };
      }
      snapshot.claimRequestId = input.requestId;
      snapshot.claimExpiresAt =
        Date.now() + READING_EXECUTION_LEASE_SECONDS * 1_000;
      return { status: "claimed", snapshot };
    },
    async release(input) {
      const snapshot = snapshots.get(
        snapshotKey(input.subjectKey, input.initialReadingId),
      );
      if (snapshot?.claimRequestId === input.requestId) {
        delete snapshot.claimRequestId;
        delete snapshot.claimExpiresAt;
      }
    },
    async consume(input) {
      const key = snapshotKey(input.subjectKey, input.initialReadingId);
      if (snapshots.get(key)?.claimRequestId === input.requestId) {
        snapshots.delete(key);
      }
    },
  };

  return { executionStore, snapshotStore };
}

let developmentStores:
  | ReturnType<typeof createInMemoryReadingRuntimeStores>
  | undefined;

export function getDefaultReadingRuntimeStores(options?: {
  forceInMemory?: boolean;
}) {
  if (options?.forceInMemory && process.env.NODE_ENV !== "production") {
    developmentStores ??= createInMemoryReadingRuntimeStores();
    return developmentStores;
  }
  if (createAdminClient()) {
    return {
      executionStore: createSupabaseReadingRequestExecutionStore(),
      snapshotStore: createSupabaseInitialReadingSnapshotStore(),
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("persistent_store_unavailable");
  }
  developmentStores ??= createInMemoryReadingRuntimeStores();
  return developmentStores;
}
