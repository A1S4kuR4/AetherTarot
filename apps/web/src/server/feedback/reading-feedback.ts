import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ReadingFeedbackLabel } from "@/lib/reading-feedback";
import type { PublicFeatureActor } from "@/server/beta/access";
import { ReadingServiceError } from "@/server/reading/errors";

export interface PersistReadingFeedbackInput {
  actor: PublicFeatureActor;
  ipHash: string;
  readingId: string;
  labels: ReadingFeedbackLabel[];
  note: string | null;
  replayConsent: boolean;
}

export type PersistReadingFeedbackResult = "inserted" | "duplicate" | "not_found";

export async function persistReadingFeedback({
  actor,
  ipHash,
  readingId,
  labels,
  note,
  replayConsent,
}: PersistReadingFeedbackInput): Promise<PersistReadingFeedbackResult> {
  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "反馈记录未配置 Supabase service role key。",
      503,
    );
  }

  let completedReadingQuery = adminClient
    .from("reading_events")
    .select("reading_id")
    .eq("reading_id", readingId)
    .eq("status", "success")
    .or("completed_initial.eq.true,completed_final.eq.true");

  completedReadingQuery = actor.userId
    ? completedReadingQuery.eq("user_id", actor.userId)
    : completedReadingQuery.is("user_id", null).eq("ip_hash", ipHash);

  const { data: completedReading, error: readingError } =
    await completedReadingQuery.limit(1).maybeSingle();

  if (readingError) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "暂时无法核验这次解读，请稍后再试。",
      503,
    );
  }

  if (!completedReading) {
    return "not_found";
  }

  const { error } = await adminClient.from("reading_feedback").insert({
    reading_id: readingId,
    user_id: actor.userId,
    email: actor.email,
    ip_hash: ipHash,
    labels,
    note,
    replay_consent: replayConsent,
    consent_version: replayConsent ? "quality-replay-v1" : null,
  });

  if (error?.code === "23505") {
    return "duplicate";
  }

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "反馈记录失败，请稍后再试。",
      503,
    );
  }

  return "inserted";
}
