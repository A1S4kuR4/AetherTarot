export type SupabaseDatabaseEnv = {
  url: string;
};

const SUPABASE_URL_PLACEHOLDERS = new Set([
  "your_supabase_url",
  "your_supabase_database_url",
]);

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (SUPABASE_URL_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseDatabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseDatabaseEnv | null {
  const url = normalizeEnvValue(env.SUPABASE_URL);

  if (!url || !isHttpUrl(url)) {
    return null;
  }

  return { url };
}
