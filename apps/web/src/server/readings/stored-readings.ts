import "server-only";

import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const DEFAULT_STORED_READINGS_LIMIT = 50;
export const MAX_STORED_READINGS_LIMIT = 100;
export const MAX_STORED_READING_NOTES_LENGTH = 2000;

export type ListStoredReadingsOptions = {
  limit?: number;
};

export function normalizeStoredReadingsLimit(limit: unknown) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_STORED_READINGS_LIMIT;
  }

  return Math.min(
    MAX_STORED_READINGS_LIMIT,
    Math.max(1, Math.trunc(limit)),
  );
}

function buildStoredReadingRow(userId: string, entry: ReadingHistoryEntry) {
  return {
    user_id: userId,
    reading_id: entry.id,
    created_at: entry.createdAt,
    spread_id: entry.spreadId,
    draw_source: entry.drawSource ?? null,
    drawn_cards: entry.drawnCards as unknown as Json,
    reading: entry.reading as unknown as Json,
    user_notes: entry.user_notes ?? null,
  };
}

function dedupeEntriesByReadingId(entries: ReadingHistoryEntry[]) {
  const seen = new Set<string>();
  const deduped: ReadingHistoryEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    deduped.push(entry);
  }

  return deduped;
}

export async function saveStoredReading(
  userId: string,
  entry: ReadingHistoryEntry,
) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return { error: "database_unavailable" as const };
  }

  const row = buildStoredReadingRow(userId, entry);

  const { error } = await adminClient
    .from("stored_readings")
    .upsert(row, { onConflict: "user_id,reading_id" });

  if (error) {
    console.warn("[stored-readings] failed to save reading", {
      code: error.code,
      message: error.message,
    });
    return { error: "insert_failed" as const };
  }

  return { error: null as null };
}

export async function listStoredReadings(
  userId: string,
  options: ListStoredReadingsOptions = {},
) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return { data: null, error: "database_unavailable" as const };
  }

  const { data, error } = await adminClient
    .from("stored_readings")
    .select("id, reading_id, created_at, spread_id, draw_source, drawn_cards, reading, user_notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(normalizeStoredReadingsLimit(options.limit));

  if (error) {
    console.warn("[stored-readings] failed to list readings", {
      code: error.code,
      message: error.message,
    });
    return { data: null, error: "query_failed" as const };
  }

  const entries: ReadingHistoryEntry[] = (data ?? []).map((row) => ({
    id: row.reading_id,
    createdAt: row.created_at,
    spreadId: row.spread_id,
    drawSource: row.draw_source as ReadingHistoryEntry["drawSource"],
    drawnCards: row.drawn_cards as unknown as ReadingHistoryEntry["drawnCards"],
    reading: row.reading as unknown as ReadingHistoryEntry["reading"],
    user_notes: row.user_notes ?? undefined,
  }));

  return { data: entries, error: null as null };
}

export async function updateStoredReadingNotes(
  userId: string,
  readingId: string,
  notes: string,
) {
  if (notes.length > MAX_STORED_READING_NOTES_LENGTH) {
    return { error: "invalid_notes" as const };
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return { error: "database_unavailable" as const };
  }

  const { error } = await adminClient
    .from("stored_readings")
    .update({ user_notes: notes })
    .eq("user_id", userId)
    .eq("reading_id", readingId);

  if (error) {
    console.warn("[stored-readings] failed to update notes", {
      code: error.code,
      message: error.message,
    });
    return { error: "update_failed" as const };
  }

  return { error: null as null };
}

export async function migrateStoredReadings(
  userId: string,
  entries: ReadingHistoryEntry[],
) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return { migrated: 0, error: "database_unavailable" as const };
  }

  const dedupedEntries = dedupeEntriesByReadingId(entries);

  if (dedupedEntries.length === 0) {
    return { migrated: 0, error: null as null };
  }

  const rows = dedupedEntries.map((entry) => buildStoredReadingRow(userId, entry));

  const { error } = await adminClient
    .from("stored_readings")
    .upsert(rows, { onConflict: "user_id,reading_id" });

  if (error) {
    console.warn("[stored-readings] failed to migrate readings", {
      code: error.code,
      message: error.message,
    });
    return { migrated: 0, error: "insert_failed" as const };
  }

  return { migrated: rows.length, error: null as null };
}
