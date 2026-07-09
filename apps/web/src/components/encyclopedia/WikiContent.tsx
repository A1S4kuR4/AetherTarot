"use client";

import Link from "next/link";
import React from "react";
import ReactMarkdown from "react-markdown";
import {
  formatSourceLabel,
  isDisabledHref,
  isSourceHref,
  mapWikiHref,
  prepareWikiMarkdown,
  sourceLabelFromHref,
} from "@/lib/encyclopedia/wiki-content";

interface WikiContentProps {
  content: string;
}

function textFromMarkdownChildren(children: React.ReactNode) {
  return React.Children.toArray(children)
    .map((child) => typeof child === "string" || typeof child === "number" ? String(child) : "")
    .join("")
    .trim();
}

export default function WikiContent({ content }: WikiContentProps) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          const childText = textFromMarkdownChildren(children);
          const sourceTextMatch = childText.match(/^来源:\s*(.+)$/);

          if (sourceTextMatch?.[1]) {
            return (
              <span className="inline-flex rounded-full border border-paper-border bg-paper px-2.5 py-1 font-sans text-[10px] font-medium text-text-muted">
                来源: {formatSourceLabel(sourceTextMatch[1])}
              </span>
            );
          }

          const mappedHref = mapWikiHref(href);

          if (isSourceHref(mappedHref)) {
            return (
              <span className="inline-flex rounded-full border border-paper-border bg-paper px-2.5 py-1 font-sans text-[10px] font-medium text-text-muted">
                来源: {sourceLabelFromHref(mappedHref)}
              </span>
            );
          }

          if (isDisabledHref(mappedHref)) {
            return (
              <span
                className="cursor-not-allowed border-b border-dashed border-paper-border text-text-muted"
                title="概念与牌阵详情页即将上线"
              >
                {children}
              </span>
            );
          }

          if (/^https?:\/\//i.test(mappedHref)) {
            return (
              <a
                href={mappedHref}
                target="_blank"
                rel="noreferrer"
                className="text-terracotta underline underline-offset-4"
              >
                {children}
              </a>
            );
          }

          return (
            <Link
              href={mappedHref}
              className="text-terracotta underline underline-offset-4"
            >
              {children}
            </Link>
          );
        },
        p: ({ children }) => (
          <p className="text-sm leading-[1.9] text-text-body">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="space-y-2 pl-4 text-sm leading-relaxed text-text-body">
            {children}
          </ul>
        ),
        li: ({ children }) => (
          <li className="list-disc pl-1 marker:text-terracotta/60">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
      }}
    >
      {prepareWikiMarkdown(content)}
    </ReactMarkdown>
  );
}
