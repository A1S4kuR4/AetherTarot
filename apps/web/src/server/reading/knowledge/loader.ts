import "server-only";

import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import type {
  TarotKnowledgeChunk,
  TarotKnowledgeOrientation,
} from "@/server/reading/knowledge/types";
import {
  parseWikiClaims,
  parseWikiFrontmatter,
  parseWikiString,
  parseWikiStringArray,
  resolveWikiRoot,
  slugifyWikiHeading,
} from "@/server/knowledge/wiki";

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

export function resolveKnowledgeWikiRoot() {
  return resolveWikiRoot();
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
  const { frontmatter, body } = parseWikiFrontmatter(rawText);
  const relativePath = path.relative(wikiRoot, absolutePath).replace(/\\/g, "/");
  const title =
    parseWikiString(frontmatter.get("title"))
    ?? path.basename(absolutePath, ".md");
  const card = parseWikiString(frontmatter.get("card_id")) ?? undefined;
  const spread = parseWikiString(frontmatter.get("spread_id")) ?? undefined;
  const sourceIds = parseWikiStringArray(frontmatter.get("sources"));
  const frontmatterTags = [
    parseWikiString(frontmatter.get("arcana")) ?? "",
    parseWikiString(frontmatter.get("suit")) ?? "",
    parseWikiString(frontmatter.get("concept_type")) ?? "",
    spread ?? "",
  ].filter(Boolean);

  return parseWikiClaims(body)
    .map((claim) => {
      const content = claim.content.trim();

      if (!content) {
        return null;
      }

      const orientation = inferOrientation(`${claim.heading}\n${claim.content}`);
      const topic = inferTopics(`${claim.heading}\n${claim.content}`);
      const tags = [
        ...frontmatterTags,
        orientation === "unknown" ? "" : orientation,
        ...topic,
      ].filter(Boolean);
      const chunk: TarotKnowledgeChunk = {
        id: `${relativePath}#${slugifyWikiHeading(claim.heading)}:p${claim.paragraphIndex}`,
        source_ids: [...new Set([...sourceIds, ...claim.sourceIds])],
        source_id: sourceIds.length > 0 ? sourceIds.join(",") : "unregistered",
        title: `${title} - ${claim.heading}`,
        content,
        source: `knowledge/wiki/${relativePath}`,
        card,
        spread,
        orientation,
        topic,
        tags,
        has_inline_source: claim.hasInlineSource,
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
