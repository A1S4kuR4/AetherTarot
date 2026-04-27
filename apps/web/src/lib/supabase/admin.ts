import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

type SupabaseAdminClient = ReturnType<typeof createSupabaseClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createAdminClient() {
  const env = getSupabaseEnv();
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!env || !serviceRoleKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createSupabaseClient<Database>(env.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
