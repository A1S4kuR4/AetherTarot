export function resolveSafeLocalRedirect(next: string | null, origin: string) {
  const fallback = new URL("/", origin);

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  const candidate = new URL(next, fallback);

  return candidate.origin === fallback.origin ? candidate : fallback;
}
