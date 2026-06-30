import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";

vi.mock("@/auth", () => ({
  auth: () => undefined,
}));

function matches(pathname: string) {
  return unstable_doesMiddlewareMatch({
    config,
    url: `https://aethertarot.cn${pathname}`,
  });
}

describe("Auth.js session proxy matching", () => {
  it.each(["/", "/login", "/new", "/ritual", "/reveal", "/reading", "/encyclopedia"])(
    "does not block public page navigation for %s",
    (pathname) => {
      expect(matches(pathname)).toBe(false);
    },
  );

  it.each([
    "/admin",
    "/api/admin/summary",
    "/api/reading",
    "/api/reading-feedback",
    "/api/encyclopedia/query",
  ])("keeps sessions fresh for protected entrypoint %s", (pathname) => {
    expect(matches(pathname)).toBe(true);
  });
});
