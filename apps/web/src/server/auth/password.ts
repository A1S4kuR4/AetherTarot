import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
