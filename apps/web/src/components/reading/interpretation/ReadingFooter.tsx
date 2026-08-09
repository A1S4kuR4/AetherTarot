"use client";

import Link from "next/link";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { getPreferredScrollBehavior } from "./utils";

interface ReadingFooterProps {
  onReset: () => void;
  onShare?: (trigger: HTMLButtonElement) => void;
}

export function ReadingFooter({ onReset, onShare }: ReadingFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
  };

  return (
    <section aria-label="解读操作" className="border-t border-paper-border/70 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center gap-2 border border-terracotta-ink bg-terracotta-ink px-5 py-2 font-serif text-sm text-paper transition-colors hover:bg-terracotta-active"
        >
          <LegacyIcon name="refresh" className="text-[16px]" />
          开启新的解读
        </button>
        {onShare ? (
          <button
            type="button"
            onClick={(event) => {
              // Safari/WebKit does not focus buttons on pointer click by default.
              // Establish the trigger explicitly so the modal can return focus.
              event.currentTarget.focus({ preventScroll: true });
              onShare(event.currentTarget);
            }}
            className="min-h-11 border-b border-ink/30 px-1 py-2 text-sm text-ink transition-colors hover:border-terracotta hover:text-terracotta"
          >
            分享
          </button>
        ) : null}
        <Link
          href="/journey"
          className="inline-flex min-h-11 items-center border-b border-paper-border px-1 py-2 text-sm text-text-muted transition-colors hover:border-terracotta hover:text-terracotta"
        >
          返回旅程
        </Link>
        <button
          type="button"
          onClick={scrollToTop}
          className="min-h-11 border-b border-paper-border px-1 py-2 text-sm text-text-muted transition-colors hover:border-terracotta hover:text-terracotta"
        >
          回到顶部
        </button>
      </div>
    </section>
  );
}
