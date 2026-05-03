import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { EncyclopediaSourceType } from "@aethertarot/shared-types";

export interface EncyclopediaWikiPage {
  title: string;
  path: string;
  type: EncyclopediaSourceType;
  sourceIds: string[];
  cardId: string | null;
  spreadId: string | null;
  body: string;
  sections: EncyclopediaWikiSection[];
}

export interface EncyclopediaWikiSection {
  heading: string;
  content: string;
}

const WIKI_DIRECTORIES = [
  ["major-arcana", "card"],
  ["minor-arcana/wands", "card"],
  ["minor-arcana/cups", "card"],
  ["minor-arcana/swords", "card"],
  ["minor-arcana/pentacles", "card"],
  ["concepts", "concept"],
  ["spreads", "spread"],
] as const;

function resolveKnowledgeWikiRoot() {
  return path.resolve(process.cwd(), "..", "..", "knowledge", "wiki");
}

function parseFrontmatter(rawText: string) {
  const match = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match?.[1]) {
    return { frontmatter: new Map<string, string>(), body: rawText };
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

function parseSections(body: string): EncyclopediaWikiSection[] {
  const lines = body.split(/\r?\n/);
  const sections: EncyclopediaWikiSection[] = [];
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

async function loadWikiFile({
  wikiRoot,
  absolutePath,
  type,
}: {
  wikiRoot: string;
  absolutePath: string;
  type: EncyclopediaSourceType;
}) {
  const rawText = await fs.readFile(absolutePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(rawText);
  const relativePath = path
    .relative(path.resolve(wikiRoot, "..", ".."), absolutePath)
    .replace(/\\/g, "/");

  return {
    title:
      parseStringValue(frontmatter.get("title"))
      ?? path.basename(absolutePath, ".md"),
    path: relativePath,
    type,
    sourceIds: parseStringArray(frontmatter.get("sources")),
    cardId: parseStringValue(frontmatter.get("card_id")),
    spreadId: parseStringValue(frontmatter.get("spread_id")),
    body,
    sections: parseSections(body),
  } satisfies EncyclopediaWikiPage;
}

export async function loadEncyclopediaWikiPages() {
  const wikiRoot = resolveKnowledgeWikiRoot();
  const pages: EncyclopediaWikiPage[] = [];

  for (const [directory, type] of WIKI_DIRECTORIES) {
    const absoluteDirectory = path.join(wikiRoot, directory);
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      pages.push(
        await loadWikiFile({
          wikiRoot,
          absolutePath: path.join(absoluteDirectory, entry.name),
          type,
        }),
      );
    }
  }

  return pages;
}
