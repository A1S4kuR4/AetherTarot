import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthEmailEventInput {
  email: string | null;
  ipHash: string;
  status: "success" | "failure";
  errorCode: string | null;
  durationMs: number;
}

export async function recordAuthEmailEvent(input: AuthEmailEventInput) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return;
  }

  const { error } = await adminClient.from("auth_email_events").insert({
    email: input.email,
    ip_hash: input.ipHash,
    status: input.status,
    error_code: input.errorCode,
    duration_ms: input.durationMs,
  });

  if (error) {
    console.warn("[observability] failed to record auth email event", {
      code: error.code,
      message: error.message,
    });
  }
}
