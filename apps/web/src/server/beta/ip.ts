import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const DEV_IP_HASH_SALT = "aethertarot-dev-ip-salt";
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERN = /(?:change[-_ ]?me|example|placeholder|replace[-_ ]?me|your[-_ ]?secret|fake)/i;

export const INTERNAL_CLIENT_IP_HEADER = "x-aethertarot-client-ip";
export const INTERNAL_PROXY_SECRET_HEADER = "x-aethertarot-proxy-secret";

function secretsMatch(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isRestrictedDevIp(ip: string) {
  return /^127\./.test(ip)
    || ip === "::1"
    || /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(ip);
}

function requireProductionSecret(name: string, value: string) {
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH || PLACEHOLDER_SECRET_PATTERN.test(value)) {
    throw new Error(`${name} must be at least 32 characters and must not be a placeholder in production.`);
  }
  return value;
}

export function validateProductionIpSecrets(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;
  const proxySecret = requireProductionSecret(
    "AETHERTAROT_PROXY_SHARED_SECRET",
    env.AETHERTAROT_PROXY_SHARED_SECRET?.trim() ?? "",
  );
  const ipSalt = requireProductionSecret(
    "AETHERTAROT_IP_HASH_SALT",
    env.AETHERTAROT_IP_HASH_SALT?.trim() ?? "",
  );
  if (secretsMatch(proxySecret, ipSalt)) {
    throw new Error("AETHERTAROT_PROXY_SHARED_SECRET and AETHERTAROT_IP_HASH_SALT must be different.");
  }
}

export function getClientIp(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
) {
  validateProductionIpSecrets(env);
  const internalIp = request.headers.get(INTERNAL_CLIENT_IP_HEADER)?.trim() ?? "";
  const suppliedSecret = request.headers.get(INTERNAL_PROXY_SECRET_HEADER)?.trim() ?? "";
  const expectedSecret = env.AETHERTAROT_PROXY_SHARED_SECRET?.trim() ?? "";
  if (
    internalIp
    && expectedSecret
    && suppliedSecret
    && secretsMatch(suppliedSecret, expectedSecret)
    && isIP(internalIp)
  ) {
    return internalIp;
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Trusted reverse-proxy client IP chain is missing or invalid.");
  }

  const fallback = env.AETHERTAROT_DEV_CLIENT_IP?.trim() || "127.0.0.1";
  if (!isIP(fallback) || !isRestrictedDevIp(fallback)) {
    throw new Error("AETHERTAROT_DEV_CLIENT_IP must be a private or loopback IP.");
  }
  return fallback;
}

export function resolveIpHashSalt(env: NodeJS.ProcessEnv = process.env) {
  const configuredSalt = env.AETHERTAROT_IP_HASH_SALT?.trim();

  if (configuredSalt) {
    if (env.NODE_ENV === "production") requireProductionSecret("AETHERTAROT_IP_HASH_SALT", configuredSalt);
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
