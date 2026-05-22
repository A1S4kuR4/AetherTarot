import { promises as fs } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTarotKnowledgeCache,
  loadTarotKnowledgeChunks,
  resolveKnowledgeWikiRoot,
} from "@/server/reading/knowledge/loader";

const WIKI_DIRECTORIES = [
  "major-arcana",
  "minor-arcana/wands",
  "minor-arcana/cups",
  "minor-arcana/swords",
  "minor-arcana/pentacles",
  "concepts",
  "spreads",
] as const;

const originalWikiRoot = process.env.AETHERTAROT_WIKI_ROOT;

async function createWikiRoot() {
  const wikiRoot = await mkdtemp(path.join(tmpdir(), "aethertarot-wiki-"));

  await Promise.all(
    WIKI_DIRECTORIES.map((directory) =>
      mkdir(path.join(wikiRoot, directory), { recursive: true }),
    ),
  );

  return wikiRoot;
}

async function writeWikiPage({
  wikiRoot,
  relativePath,
  card = "the-fool",
  content = "## 正位\n这是一段用于测试的塔罗知识。",
}: {
  wikiRoot: string;
  relativePath: string;
  card?: string;
  content?: string;
}) {
  const absolutePath = path.join(wikiRoot, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(
    absolutePath,
    [
      "---",
      'title: "测试牌"',
      `card_id: "${card}"`,
      'sources: ["TEST"]',
      'arcana: "major"',
      "---",
      content,
    ].join("\n"),
    "utf8",
  );
}

afterEach(() => {
  if (originalWikiRoot === undefined) {
    delete process.env.AETHERTAROT_WIKI_ROOT;
  } else {
    process.env.AETHERTAROT_WIKI_ROOT = originalWikiRoot;
  }

  clearTarotKnowledgeCache();
  vi.restoreAllMocks();
});

describe("tarot knowledge loader", () => {
  it("prioritizes AETHERTAROT_WIKI_ROOT over the default monorepo path", async () => {
    const wikiRoot = await createWikiRoot();
    await writeWikiPage({
      wikiRoot,
      relativePath: "major-arcana/env-card.md",
    });

    process.env.AETHERTAROT_WIKI_ROOT = wikiRoot;

    expect(resolveKnowledgeWikiRoot()).toBe(path.resolve(wikiRoot));

    const chunks = await loadTarotKnowledgeChunks();

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "knowledge/wiki/major-arcana/env-card.md",
        }),
      ]),
    );
  });

  it("keeps the default monorepo wiki path compatible", async () => {
    delete process.env.AETHERTAROT_WIKI_ROOT;

    const wikiRoot = resolveKnowledgeWikiRoot();
    const chunks = await loadTarotKnowledgeChunks();

    expect(wikiRoot.replace(/\\/g, "/")).toMatch(/knowledge\/wiki$/);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("warns when a wiki directory cannot be read without failing the load", async () => {
    const wikiRoot = await mkdtemp(path.join(tmpdir(), "aethertarot-bad-dir-"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadTarotKnowledgeChunks({ wikiRoot })).resolves.toEqual([]);

    const warnings = warnSpy.mock.calls.flat().join("\n");

    expect(warnSpy).toHaveBeenCalled();
    expect(warnings).toContain(wikiRoot);
    expect(warnings).toMatch(/Reason:/);
  });

  it("warns when a wiki file cannot be read without dropping good files", async () => {
    const wikiRoot = await createWikiRoot();
    await writeWikiPage({
      wikiRoot,
      relativePath: "major-arcana/good.md",
    });
    await writeWikiPage({
      wikiRoot,
      relativePath: "major-arcana/broken.md",
    });
    const originalReadFile = fs.readFile;
    vi.spyOn(fs, "readFile").mockImplementation((async (...args) => {
      const [filePath] = args;

      if (String(filePath).endsWith("broken.md")) {
        throw new Error("planned broken file");
      }

      return originalReadFile(...args);
    }) as typeof fs.readFile);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const chunks = await loadTarotKnowledgeChunks({ wikiRoot });
    const warnings = warnSpy.mock.calls.flat().join("\n");

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "knowledge/wiki/major-arcana/good.md",
        }),
      ]),
    );
    expect(warnings).toContain(path.join(wikiRoot, "major-arcana", "broken.md"));
    expect(warnings).toContain("planned broken file");
  });

  it("serves chunks from cache until the cache is cleared", async () => {
    const wikiRoot = await createWikiRoot();
    await writeWikiPage({
      wikiRoot,
      relativePath: "major-arcana/first.md",
    });

    const firstLoad = await loadTarotKnowledgeChunks({ wikiRoot });

    await writeWikiPage({
      wikiRoot,
      relativePath: "major-arcana/second.md",
    });

    const cachedLoad = await loadTarotKnowledgeChunks({ wikiRoot });
    clearTarotKnowledgeCache();
    const reloaded = await loadTarotKnowledgeChunks({ wikiRoot });

    expect(firstLoad).toHaveLength(1);
    expect(cachedLoad).toHaveLength(1);
    expect(reloaded).toHaveLength(2);
  });
});
