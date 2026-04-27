import "server-only";

import { createHash } from "node:crypto";

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

export function hashClientIp(
  ip: string,
  salt = process.env.AETHERTAROT_IP_HASH_SALT ?? "aethertarot-dev-ip-salt",
) {
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex");
}

export function getClientIpHash(request: Request) {
  return hashClientIp(getClientIp(request));
}
