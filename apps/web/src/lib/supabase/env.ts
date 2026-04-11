export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

const SUPABASE_PLACEHOLDERS = new Set([
  "your_supabase_url",
  "your_supabase_anon_key",
]);

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (SUPABASE_PLACEHOLDERS.has(normalized.toLowerCase())) {
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

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  if (!isHttpUrl(url)) {
    return null;
  }

  return { url, anonKey };
}
