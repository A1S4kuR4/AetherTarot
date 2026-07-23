import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "../src/lib/supabase/admin";

const REDACTED_KEYS = new Set([
  "user_id",
  "email",
  "ip_hash",
  "session_capsule",
  "prior_session_capsule",
  "session_memory",
  "memory",
  "prompt",
  "system_prompt",
  "user_prompt",
]);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{7,}\d)/g;
const LONG_ID_PATTERN = /\b\d{7,}\b/g;

function redactText(value: string) {
  return value
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(URL_PATTERN, "[REDACTED_URL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(LONG_ID_PATTERN, "[REDACTED_ID]");
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !REDACTED_KEYS.has(key.toLowerCase()))
      .map(([key, nested]) => [key, redactValue(nested)]),
  );
}

async function main() {
  const salt = process.env.AETHERTAROT_REPLAY_HMAC_SALT?.trim();
  if (!salt) {
    throw new Error("AETHERTAROT_REPLAY_HMAC_SALT is required.");
  }
  const client = createAdminClient();
  if (!client) {
    throw new Error("Supabase service-role configuration is required.");
  }

  const { data: feedbackRows, error: feedbackError } = await client
    .from("reading_feedback")
    .select("id, created_at, reading_id, user_id, labels, note, consent_version")
    .eq("replay_consent", true)
    .order("created_at", { ascending: false });
  if (feedbackError) {
    throw feedbackError;
  }

  const readingIds = [...new Set((feedbackRows ?? []).map((row) => row.reading_id))];
  const [{ data: readings, error: readingsError }, { data: events, error: eventsError }] =
    await Promise.all([
      client
        .from("stored_readings")
        .select("reading_id, user_id, reading, spread_id, draw_source, created_at, thread_id")
        .in("reading_id", readingIds),
      client
        .from("reading_events")
        .select("reading_id, user_id, phase, provider, status, error_code, agent_trace")
        .in("reading_id", readingIds)
        .eq("status", "success"),
    ]);
  if (readingsError) {
    throw readingsError;
  }
  if (eventsError) {
    throw eventsError;
  }

  const readingById = new Map((readings ?? []).map((row) => [row.reading_id, row]));
  const eventById = new Map((events ?? []).map((row) => [row.reading_id, row]));
  const cases = (feedbackRows ?? []).flatMap((feedback) => {
    const reading = readingById.get(feedback.reading_id);
    const event = eventById.get(feedback.reading_id);
    if (
      !reading
      || !event
      || reading.user_id !== feedback.user_id
      || event.user_id !== feedback.user_id
    ) {
      return [];
    }
    return [{
      case_id: createHmac("sha256", salt).update(feedback.id).digest("hex"),
      created_at: feedback.created_at,
      labels: feedback.labels,
      feedback_note: feedback.note ? redactText(feedback.note) : null,
      consent_version: feedback.consent_version,
      reading: redactValue(reading.reading),
      runtime: {
        phase: event.phase,
        provider: event.provider,
        spread_id: reading.spread_id,
        draw_source: reading.draw_source,
        agent_trace: redactValue(event.agent_trace),
      },
    }];
  });

  const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "evals");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `feedback-replay-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await writeFile(outputPath, `${JSON.stringify({ version: 1, cases }, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
