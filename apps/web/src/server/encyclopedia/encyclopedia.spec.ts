import { describe, expect, it, vi } from "vitest";
import { handleEncyclopediaQueryPost } from "@/app/api/encyclopedia/query/route";
import { ReadingServiceError } from "@/server/reading/errors";
import { retrieveEncyclopediaSources } from "@/server/encyclopedia/retrieval";
import { generateEncyclopediaAnswer } from "@/server/encyclopedia/service";
import { loadEncyclopediaWikiPages } from "@/server/encyclopedia/wiki";
import { LlmEncyclopediaProvider } from "@/server/encyclopedia/provider";
import type { AuthenticatedTester } from "@/server/beta/access";

const TESTER: AuthenticatedTester = {
  userId: "00000000-0000-0000-0000-000000000001",
  email: "tester@example.com",
  role: "tester",
};

type RouteDependencies = NonNullable<Parameters<typeof handleEncyclopediaQueryPost>[1]>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/encyclopedia/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function buildDependencies(overrides: RouteDependencies = {}) {
  return {
    getIpHash: () => "ip-hash",
    requireAccess: vi.fn(async () => TESTER),
    consumeQuota: vi.fn(async () => undefined),
    generateAnswer: vi.fn(async () => ({
      answer: "愚者强调进入未知时的开放与风险意识。",
      sources: [
        {
          title: "愚者 (The Fool)",
          path: "knowledge/wiki/major-arcana/the-fool.md",
          type: "card" as const,
          source_ids: ["78W"],
          excerpt: "愚者代表原点、空无与未被限定的可能性。",
        },
      ],
      related_cards: ["愚者 (The Fool)"],
      related_concepts: [],
      related_spreads: [],
      boundary_note: null,
    })),
    collectUsage: vi.fn(async (callback) => ({
      result: await callback(),
      calls: [],
    })),
    recordEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as {
    answer?: string;
    sources?: unknown[];
    boundary_note?: string | null;
    error?: { code?: string; message?: string };
  };
}

describe("encyclopedia wiki retrieval", () => {
  it("loads wiki pages and parses frontmatter plus sections", async () => {
    const pages = await loadEncyclopediaWikiPages();
    const fool = pages.find((page) => page.path.endsWith("the-fool.md"));

    expect(fool).toMatchObject({
      title: "愚者 (The Fool)",
      type: "card",
      cardId: "the-fool",
      sourceIds: expect.arrayContaining(["78W"]),
    });
    expect(fool?.sections.some((section) => section.heading.includes("核心牌义"))).toBe(true);
  });

  it("retrieves card, concept, and spread pages from deterministic terms", async () => {
    const pages = await loadEncyclopediaWikiPages();

    expect(
      retrieveEncyclopediaSources({ pages, query: "愚者逆位怎么理解？" })
        .map((source) => source.path),
    ).toContain("knowledge/wiki/major-arcana/the-fool.md");
    expect(
      retrieveEncyclopediaSources({ pages, query: "逆位原则是什么？" })
        .map((source) => source.path),
    ).toContain("knowledge/wiki/concepts/reversal-reading-principles.md");
    expect(
      retrieveEncyclopediaSources({ pages, query: "赛尔特十字结果位是什么意思？" })
        .map((source) => source.path),
    ).toContain("knowledge/wiki/spreads/celtic-cross.md");
  });
});

describe("encyclopedia service", () => {
  it("returns a bounded no-source answer without calling the provider", async () => {
    const provider = {
      generateAnswer: vi.fn(),
    };
    const response = await generateEncyclopediaAnswer(
      { query: "zzzz-not-found" },
      { provider, loadPages: async () => [] },
    );

    expect(response.sources).toHaveLength(0);
    expect(response.answer).toMatch(/没有在当前塔罗百科资料中找到/);
    expect(provider.generateAnswer).not.toHaveBeenCalled();
  });

  it("adds a boundary note and suppresses deterministic provider wording", async () => {
    const response = await generateEncyclopediaAnswer(
      { query: "愚者是不是代表他一定会回来？", cardId: "fool" },
      {
        provider: {
          generateAnswer: vi.fn(async () => ({
            answer: "他一定会回来。",
            related_cards: [],
            related_concepts: [],
            related_spreads: [],
          })),
        },
      },
    );

    expect(response.boundary_note).toMatch(/第三方/);
    expect(response.answer).not.toContain("他一定会回来");
    expect(response.answer).toMatch(/边界提醒/);
  });
});

describe("encyclopedia LLM provider", () => {
  const providerConfig = {
    baseUrl: "https://llm.example.test",
    model: "test-model",
    temperature: 0.2,
    timeoutMs: 1000,
    maxOutputTokens: 800,
  };
  const source = {
    title: "愚者 (The Fool)",
    path: "knowledge/wiki/major-arcana/the-fool.md",
    type: "card" as const,
    source_ids: ["78W"],
    excerpt: "愚者代表原点。",
    content: "核心牌义\n愚者代表原点、空无与未被限定的可能性。",
  };

  it("normalizes valid JSON answer payloads", async () => {
    const provider = new LlmEncyclopediaProvider(
      providerConfig,
      vi.fn(async () =>
        new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "愚者代表开放的新起点。",
                  related_cards: ["愚者 (The Fool)"],
                  related_concepts: [],
                  related_spreads: [],
                }),
              },
            },
          ],
        })),
      ) as typeof fetch,
    );

    await expect(
      provider.generateAnswer({
        query: "愚者是什么意思？",
        sources: [source],
        boundaryNote: null,
      }),
    ).resolves.toMatchObject({
      answer: "愚者代表开放的新起点。",
      related_cards: ["愚者 (The Fool)"],
    });
  });

  it("fails when provider message is not valid JSON", async () => {
    const provider = new LlmEncyclopediaProvider(
      providerConfig,
      vi.fn(async () =>
        new Response(JSON.stringify({
          choices: [{ message: { content: "不是 JSON" } }],
        })),
      ) as typeof fetch,
    );

    await expect(
      provider.generateAnswer({
        query: "愚者是什么意思？",
        sources: [source],
        boundaryNote: null,
      }),
    ).rejects.toMatchObject({
      code: "generation_failed",
    });
  });

  it("maps failed fetches to provider_unavailable", async () => {
    const provider = new LlmEncyclopediaProvider(
      providerConfig,
      vi.fn(async () => {
        throw new Error("network down");
      }) as typeof fetch,
    );

    await expect(
      provider.generateAnswer({
        query: "愚者是什么意思？",
        sources: [source],
        boundaryNote: null,
      }),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });
});

describe("encyclopedia query route", () => {
  it("rejects invalid payloads before access and provider work", async () => {
    const deps = buildDependencies();
    const response = await handleEncyclopediaQueryPost(buildRequest({ query: "" }), deps);
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("invalid_request");
    expect(deps.requireAccess).not.toHaveBeenCalled();
    expect(deps.generateAnswer).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before generating an answer", async () => {
    const deps = buildDependencies({
      requireAccess: vi.fn(async () => {
        throw new ReadingServiceError(
          "unauthorized",
          "请先登录后再使用内测服务。",
          401,
        );
      }),
    });
    const response = await handleEncyclopediaQueryPost(
      buildRequest({ query: "愚者是什么意思？" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload.error?.code).toBe("unauthorized");
    expect(deps.generateAnswer).not.toHaveBeenCalled();
  });

  it("rejects quota-limited requests before generating an answer", async () => {
    const deps = buildDependencies({
      consumeQuota: vi.fn(async () => {
        throw new ReadingServiceError(
          "rate_limited",
          "当前邮箱今日百科问答次数已达上限，请明天再试。",
          429,
        );
      }),
    });
    const response = await handleEncyclopediaQueryPost(
      buildRequest({ query: "愚者是什么意思？" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload.error?.code).toBe("rate_limited");
    expect(deps.generateAnswer).not.toHaveBeenCalled();
  });

  it("returns the encyclopedia answer shape on success", async () => {
    const deps = buildDependencies();
    const response = await handleEncyclopediaQueryPost(
      buildRequest({ query: "愚者是什么意思？", cardId: "fool" }),
      deps,
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.answer).toMatch(/愚者/);
    expect(payload.sources).toHaveLength(1);
    expect(deps.consumeQuota).toHaveBeenCalledWith({
      tester: TESTER,
      ipHash: "ip-hash",
    });
  });
});
