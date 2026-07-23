import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { EncyclopediaSourceType } from "@aethertarot/shared-types";
import {
  parseWikiClaims,
  parseWikiFrontmatter,
  parseWikiSections,
  parseWikiString,
  parseWikiStringArray,
  resolveWikiRoot,
  slugifyWikiHeading,
} from "@/server/knowledge/wiki";

export interface EncyclopediaWikiPage {
  title: string;
  path: string;
  type: EncyclopediaSourceType;
  sourceIds: string[];
  cardId: string | null;
  spreadId: string | null;
  body: string;
  sections: EncyclopediaWikiSection[];
  claims?: EncyclopediaWikiSection[];
}

export interface EncyclopediaWikiSection {
  heading: string;
  content: string;
  claimId?: string;
  sourceIds?: string[];
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
  const { frontmatter, body } = parseWikiFrontmatter(rawText);
  const relativePath = path
    .relative(path.resolve(wikiRoot, "..", ".."), absolutePath)
    .replace(/\\/g, "/");

  const pageSourceIds = parseWikiStringArray(frontmatter.get("sources"));
  return {
    title:
      parseWikiString(frontmatter.get("title"))
      ?? path.basename(absolutePath, ".md"),
    path: relativePath,
    type,
    sourceIds: pageSourceIds,
    cardId: parseWikiString(frontmatter.get("card_id")),
    spreadId: parseWikiString(frontmatter.get("spread_id")),
    body,
    sections: parseWikiSections(body),
    claims: parseWikiClaims(body).map((claim) => ({
      heading: claim.heading,
      content: claim.content,
      claimId:
        `${relativePath}#${slugifyWikiHeading(claim.heading)}:p${claim.paragraphIndex}`,
      sourceIds: [...new Set([...pageSourceIds, ...claim.sourceIds])],
    })),
  } satisfies EncyclopediaWikiPage;
}

export async function loadEncyclopediaWikiPages() {
  const wikiRoot = resolveWikiRoot();
  const pages: EncyclopediaWikiPage[] = [];

  for (const [directory, type] of WIKI_DIRECTORIES) {
    const absoluteDirectory = path.join(
      /* turbopackIgnore: true */ wikiRoot,
      directory,
    );
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      pages.push(
        await loadWikiFile({
          wikiRoot,
          absolutePath: path.join(
            /* turbopackIgnore: true */ absoluteDirectory,
            entry.name,
          ),
          type,
        }),
      );
    }
  }

  return pages;
}
