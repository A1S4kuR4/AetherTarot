import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("trusted IP resolver adoption", () => {
  it.each([
    "src/auth.ts",
    "src/app/api/reading/route.ts",
    "src/app/api/encyclopedia/query/route.ts",
    "src/app/api/reading-feedback/route.ts",
    "src/app/api/growth-events/route.ts",
  ])("uses the shared getClientIpHash boundary in %s", (relativePath) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
    expect(source).toMatch(/getClientIpHash/);
    expect(source).toMatch(/@\/server\/beta\/ip/);
  });
});
