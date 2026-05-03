import "server-only";

import { createHash } from "node:crypto";

const DEV_IP_HASH_SALT = "aethertarot-dev-ip-salt";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

export function getClientIp(request: Request) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip"))
    ?? firstHeaderValue(request.headers.get("x-forwarded-for"))
    ?? firstHeaderValue(request.headers.get("x-real-ip"))
    ?? "unknown"
  );
}

export function resolveIpHashSalt(env: NodeJS.ProcessEnv = process.env) {
  const configuredSalt = env.AETHERTAROT_IP_HASH_SALT?.trim();

  if (configuredSalt) {
    return configuredSalt;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "AETHERTAROT_IP_HASH_SALT must be configured in production.",
    );
  }

  return DEV_IP_HASH_SALT;
}

export function hashClientIp(
  ip: string,
  salt = resolveIpHashSalt(),
) {
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex");
}

export function getClientIpHash(request: Request) {
  return hashClientIp(getClientIp(request));
}
