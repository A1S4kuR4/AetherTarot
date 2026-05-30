import { describe, expect, it } from "vitest";
import {
  resolvePublicRequestOrigin,
  resolveSafeLocalRedirect,
} from "@/lib/navigation/safe-local-redirect";

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

describe("resolvePublicRequestOrigin", () => {
  const internalUrl = new URL(
    "https://localhost:3000/api/auth/callback/keycloak?next=%2F",
  );

  it("uses the configured public site URL for production callbacks", () => {
    expect(
      resolvePublicRequestOrigin({
        requestUrl: internalUrl,
        configuredSiteUrl: "https://aethertarot.cn/login",
        forwardedHost: "unexpected.example",
        forwardedProto: "https",
      }),
    ).toBe("https://aethertarot.cn");
  });

  it("uses reverse proxy forwarding headers when the request URL is internal", () => {
    expect(
      resolvePublicRequestOrigin({
        requestUrl: internalUrl,
        forwardedHost: "aethertarot.cn",
        forwardedProto: "https",
      }),
    ).toBe("https://aethertarot.cn");
  });

  it("falls back to the request URL origin outside a configured proxy", () => {
    expect(resolvePublicRequestOrigin({ requestUrl: internalUrl })).toBe(
      "https://localhost:3000",
    );
  });
});
