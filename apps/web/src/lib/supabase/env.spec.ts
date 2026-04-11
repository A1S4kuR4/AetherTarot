import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseEnv } from "@/lib/supabase/env";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  if (ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL;
  }

  if (ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
});

describe("getSupabaseEnv", () => {
  it("treats example placeholder values as unconfigured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "your_supabase_url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "your_supabase_anon_key";

    expect(getSupabaseEnv()).toBeNull();
  });

  it("treats invalid URLs as unconfigured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseEnv()).toBeNull();
  });

  it("returns normalized env values for a valid Supabase config", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://example.supabase.co ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = " anon-key ";

    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});
