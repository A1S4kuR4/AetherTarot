#!/usr/bin/env node

/**
 * Set or update a beta tester's password.
 *
 * Usage:
 *   node scripts/set-tester-password.mjs <email> <password>
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/set-tester-password.mjs <email> <password>");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizedEmail = email.trim().toLowerCase();
const passwordHash = hashPassword(password);

const { data, error } = await supabase
  .from("beta_testers")
  .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
  .eq("email", normalizedEmail)
  .select("email, role, is_active")
  .maybeSingle();

if (error) {
  console.error("Database error:", error.message);
  process.exit(1);
}

if (!data) {
  console.error(`No beta_tester found with email: ${normalizedEmail}`);
  process.exit(1);
}

console.log(`Password set for ${data.email} (role: ${data.role}, active: ${data.is_active})`);
