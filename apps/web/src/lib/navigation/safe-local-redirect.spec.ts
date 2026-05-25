import { describe, expect, it } from "vitest";
import { resolveSafeLocalRedirect } from "@/lib/navigation/safe-local-redirect";

describe("resolveSafeLocalRedirect", () => {
  const origin = "https://app.example.com";

  it("preserves local application paths", () => {
    expect(
      resolveSafeLocalRedirect("/encyclopedia?card=fool", origin).toString(),
    ).toBe("https://app.example.com/encyclopedia?card=fool");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(
      resolveSafeLocalRedirect("https://outside.example", origin).toString(),
    ).toBe("https://app.example.com/");
    expect(
      resolveSafeLocalRedirect("//outside.example", origin).toString(),
    ).toBe("https://app.example.com/");
    expect(
      resolveSafeLocalRedirect("/\\outside.example", origin).toString(),
    ).toBe("https://app.example.com/");
  });
});
