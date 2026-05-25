export function resolveSafeLocalRedirect(next: string | null, origin: string) {
  const fallback = new URL("/", origin);

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  const candidate = new URL(next, fallback);

  return candidate.origin === fallback.origin ? candidate : fallback;
}

interface PublicRequestOriginInput {
  requestUrl: URL;
  configuredSiteUrl?: string;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
}

function resolveHttpOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || null;
}

export function resolvePublicRequestOrigin({
  requestUrl,
  configuredSiteUrl,
  forwardedHost,
  forwardedProto,
  host,
}: PublicRequestOriginInput) {
  const configuredOrigin = resolveHttpOrigin(configuredSiteUrl);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const proxyHost = firstForwardedValue(forwardedHost) ?? firstForwardedValue(host);
  const proxyProto = firstForwardedValue(forwardedProto);
  const proxyOrigin =
    proxyHost && proxyProto
      ? resolveHttpOrigin(`${proxyProto}://${proxyHost}`)
      : null;

  return proxyOrigin ?? requestUrl.origin;
}
