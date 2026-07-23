import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

const INLINE_SOURCE_PATTERN = /\[来源:\s*([^\]]+)\]/gi;

export interface ParsedWikiSection {
  heading: string;
  content: string;
}

export interface ParsedWikiClaim {
  heading: string;
  paragraphIndex: number;
  content: string;
  sourceIds: string[];
  hasInlineSource: boolean;
}

export function resolveWikiRoot() {
  const configured = process.env.AETHERTAROT_WIKI_ROOT?.trim();
  if (configured) {
    return path.resolve(/*turbopackIgnore: true*/ configured);
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

export function parseWikiFrontmatter(rawText: string) {
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

export function parseWikiString(value: string | undefined) {
  if (!value || value === "null") {
    return null;
  }
  return value.replace(/^"|"$/g, "").trim() || null;
}

export function parseWikiStringArray(value: string | undefined) {
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

export function parseWikiSections(body: string): ParsedWikiSection[] {
  const sections: ParsedWikiSection[] = [];
  let heading = "概述";
  let lines: string[] = [];

  const flush = () => {
    const content = lines.join("\n").trim();
    if (content) {
      sections.push({ heading, content });
    }
    lines = [];
  };

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+)$/);
    if (match?.[1]) {
      flush();
      heading = match[1].trim();
    } else if (!line.startsWith("---")) {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

function extractInlineSources(value: string) {
  const sourceIds: string[] = [];
  const content = value.replace(INLINE_SOURCE_PATTERN, (_match, rawIds: string) => {
    for (const sourceId of rawIds.split(/[,，、]/).map((item) => item.trim())) {
      if (sourceId && !sourceIds.includes(sourceId)) {
        sourceIds.push(sourceId);
      }
    }
    return "";
  });

  return {
    content: content.replace(/[ \t]+\n/g, "\n").replace(/\s{2,}/g, " ").trim(),
    sourceIds,
  };
}

export function parseWikiClaims(body: string): ParsedWikiClaim[] {
  return parseWikiSections(body).flatMap((section) => {
    const blocks: string[] = [];
    let paragraph: string[] = [];
    const flushParagraph = () => {
      const content = paragraph.join(" ").trim();
      if (content) {
        blocks.push(content);
      }
      paragraph = [];
    };

    for (const rawLine of section.content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        continue;
      }
      if (/^(?:[-*+]|\d+\.)\s+/.test(line)) {
        flushParagraph();
        blocks.push(line.replace(/^(?:[-*+]|\d+\.)\s+/, "").trim());
        continue;
      }
      if (/^#{3,}\s+/.test(line)) {
        flushParagraph();
        continue;
      }
      paragraph.push(line);
    }
    flushParagraph();

    return blocks
      .map((block, paragraphIndex) => {
        const parsed = extractInlineSources(block);
        return parsed.content
          ? {
              heading: section.heading,
              paragraphIndex,
              content: parsed.content,
              sourceIds: parsed.sourceIds,
              hasInlineSource: parsed.sourceIds.length > 0,
            }
          : null;
      })
      .filter((claim): claim is ParsedWikiClaim => claim !== null);
  });
}

export function slugifyWikiHeading(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
    || "section"
  );
}
