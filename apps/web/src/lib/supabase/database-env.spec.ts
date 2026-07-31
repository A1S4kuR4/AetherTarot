import { describe, expect, it } from "vitest";
import { getSupabaseDatabaseEnv } from "@/lib/supabase/database-env";

describe("getSupabaseDatabaseEnv", () => {
  it("ignores missing and placeholder Supabase database URLs", () => {
    expect(getSupabaseDatabaseEnv({})).toBeNull();
    expect(
      getSupabaseDatabaseEnv({
        SUPABASE_URL: "your_supabase_url",
      }),
    ).toBeNull();
  });

  it("rejects non-http Supabase database URLs", () => {
    expect(
      getSupabaseDatabaseEnv({
        SUPABASE_URL: "postgres://example",
      }),
    ).toBeNull();
  });

  it("returns normalized server-only Supabase database URLs", () => {
    expect(
      getSupabaseDatabaseEnv({
        SUPABASE_URL: " https://example.supabase.co ",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
    });
  });

  it("does not read public Supabase Auth environment variables", () => {
    expect(
      getSupabaseDatabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://public.example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toBeNull();
  });

  it("disables Supabase in non-production local-only mode", () => {
    expect(
      getSupabaseDatabaseEnv({
        NODE_ENV: "development",
        AETHERTAROT_LOCAL_ONLY: "1",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
  });

  it("never lets the local-only flag disable production Supabase", () => {
    expect(
      getSupabaseDatabaseEnv({
        NODE_ENV: "production",
        AETHERTAROT_LOCAL_ONLY: "1",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
    });
  });
});
