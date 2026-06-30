import "server-only";

import { existsSync, promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import type {
  TarotKnowledgeChunk,
  TarotKnowledgeOrientation,
} from "@/server/reading/knowledge/types";

const WIKI_DIRECTORIES = [
  "major-arcana",
  "minor-arcana/wands",
  "minor-arcana/cups",
  "minor-arcana/swords",
  "minor-arcana/pentacles",
  "concepts",
  "spreads",
] as const;

export const TAROT_KNOWLEDGE_CACHE_TTL_MS = 60_000;

interface TarotKnowledgeCacheEntry {
  expiresAt: number;
  chunks: TarotKnowledgeChunk[];
}

const tarotKnowledgeCache = new Map<string, TarotKnowledgeCacheEntry>();

const TOPIC_KEYWORDS = [
  ["relationship", /关系|情感|亲密|伴侣|沟通/],
  ["career", /事业|职业|工作|发展|项目|资源|任务/],
  ["self_growth", /自我|成长|反思|内在|情绪|觉察/],
  ["decision", /选择|决策|权衡|行动|判断|取舍/],
] as const;

interface ParsedWikiSection {
  heading: string;
  content: string;
}

export function resolveKnowledgeWikiRoot() {
  const envWikiRoot = process.env.AETHERTAROT_WIKI_ROOT?.trim();

  if (envWikiRoot) {
    return path.resolve(/*turbopackIgnore: true*/ envWikiRoot);
  }

  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "knowledge", "wiki"),
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "..",
      "..",
      "knowledge",
      "wiki",
    ),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1];
}

function parseFrontmatter(rawText: string) {
  const match = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match?.[1]) {
    return { frontmatter: new Map<string, string>(), body: rawText.trim() };
  }

  const frontmatter = new Map<string, string>();

  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex < 0) {
      continue;
    }

    frontmatter.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim(),
    );
  }

  return {
    frontmatter,
    body: rawText.slice(match[0].length).trim(),
  };
}

function parseStringValue(value: string | undefined) {
  if (!value || value === "null") {
    return null;
  }

  return value.replace(/^"|"$/g, "").trim() || null;
}

function parseStringArray(value: string | undefined) {
  if (!value) {
    return [];
  }

  const match = value.match(/^\[(.*)\]$/);

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function parseSections(body: string): ParsedWikiSection[] {
  const lines = body.split(/\r?\n/);
  const sections: ParsedWikiSection[] = [];
  let currentHeading = "概述";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch?.[1]) {
      if (currentLines.join("\n").trim()) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      }

      currentHeading = headingMatch[1].trim();
      currentLines = [];
      continue;
    }

    if (!line.startsWith("---")) {
      currentLines.push(line);
    }
  }

  if (currentLines.join("\n").trim()) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

function inferOrientation(text: string): TarotKnowledgeOrientation {
  if (/逆位|reversed/i.test(text)) {
    return "reversed";
  }

  if (/正位|upright/i.test(text)) {
    return "upright";
  }

  return "unknown";
}

function inferTopics(text: string) {
  return TOPIC_KEYWORDS
    .filter(([, pattern]) => pattern.test(text))
    .map(([topic]) => topic);
}

function slugify(value: string) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || "section";
}

function buildSourceId(sourceIds: string[]) {
  return sourceIds.length > 0 ? sourceIds.join(",") : "unregistered";
}

function formatErrorReason(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function warnKnowledgeLoadFailure({
  kind,
  targetPath,
  error,
}: {
  kind: "directory" | "file";
  targetPath: string;
  error: unknown;
}) {
  console.warn(
    `[AetherTarot knowledge loader] Failed to load wiki ${kind}: ${targetPath}. Reason: ${formatErrorReason(error)}`,
  );
}

async function loadWikiFile({
  wikiRoot,
  absolutePath,
}: {
  wikiRoot: string;
  absolutePath: string;
}) {
  const rawText = await fs.readFile(absolutePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(rawText);
  const relativePath = path.relative(wikiRoot, absolutePath).replace(/\\/g, "/");
  const title =
    parseStringValue(frontmatter.get("title"))
    ?? path.basename(absolutePath, ".md");
  const card = parseStringValue(frontmatter.get("card_id")) ?? undefined;
  const spread = parseStringValue(frontmatter.get("spread_id")) ?? undefined;
  const sourceIds = parseStringArray(frontmatter.get("sources"));
  const frontmatterTags = [
    parseStringValue(frontmatter.get("arcana")) ?? "",
    parseStringValue(frontmatter.get("suit")) ?? "",
    parseStringValue(frontmatter.get("concept_type")) ?? "",
    spread ?? "",
  ].filter(Boolean);

  return parseSections(body)
    .map((section) => {
      const content = `${section.heading}\n${section.content}`.trim();

      if (!content) {
        return null;
      }

      const orientation = inferOrientation(section.heading);
      const topic = inferTopics(`${section.heading}\n${section.content}`);
      const tags = [
        ...frontmatterTags,
        orientation === "unknown" ? "" : orientation,
        ...topic,
      ].filter(Boolean);
      const chunk: TarotKnowledgeChunk = {
        id: `${relativePath}#${slugify(section.heading)}`,
        source_id: buildSourceId(sourceIds),
        title: `${title} - ${section.heading}`,
        content,
        source: `knowledge/wiki/${relativePath}`,
        card,
        orientation,
        topic,
        tags,
      };

      return chunk;
    })
    .filter((chunk): chunk is TarotKnowledgeChunk => Boolean(chunk));
}

async function loadTarotKnowledgeChunksFromDisk(wikiRoot: string) {
  const chunks: TarotKnowledgeChunk[] = [];

  for (const directory of WIKI_DIRECTORIES) {
    const absoluteDirectory = path.join(/*turbopackIgnore: true*/ wikiRoot, directory);
    let entries: Dirent[];

    try {
      entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      warnKnowledgeLoadFailure({
        kind: "directory",
        targetPath: absoluteDirectory,
        error,
      });
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      try {
        const absolutePath = path.join(/*turbopackIgnore: true*/ absoluteDirectory, entry.name);
        chunks.push(
          ...(await loadWikiFile({
            wikiRoot,
            absolutePath,
          })),
        );
      } catch (error) {
        warnKnowledgeLoadFailure({
          kind: "file",
          targetPath: path.join(/*turbopackIgnore: true*/ absoluteDirectory, entry.name),
          error,
        });
        continue;
      }
    }
  }

  return chunks;
}

export async function loadTarotKnowledgeChunks(options?: {
  wikiRoot?: string;
}) {
  const wikiRoot = options?.wikiRoot
    ? path.resolve(/*turbopackIgnore: true*/ options.wikiRoot)
    : resolveKnowledgeWikiRoot();
  const now = Date.now();
  const cached = tarotKnowledgeCache.get(wikiRoot);

  if (cached && cached.expiresAt > now) {
    return cached.chunks;
  }

  const chunks = await loadTarotKnowledgeChunksFromDisk(wikiRoot);

  tarotKnowledgeCache.set(wikiRoot, {
    chunks,
    expiresAt: now + TAROT_KNOWLEDGE_CACHE_TTL_MS,
  });

  return chunks;
}

export function clearTarotKnowledgeCache() {
  tarotKnowledgeCache.clear();
}
