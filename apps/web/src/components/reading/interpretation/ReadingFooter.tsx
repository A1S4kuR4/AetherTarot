"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";
import { getPreferredScrollBehavior } from "./utils";

interface ReadingFooterProps {
  onReset: () => void;
  onShare?: () => void;
}

export function ReadingFooter({ onReset, onShare }: ReadingFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
  };

  return (
    <section aria-label="解读操作" className="border-t border-paper-border/70 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onReset}
          className="btn-primary"
        >
          <LegacyIcon name="refresh" className="text-[16px]" />
          再来一次解读
        </button>
        {onShare ? (
          <button
            type="button"
            onClick={onShare}
            className="btn-secondary"
          >
            分享
          </button>
        ) : null}
        <button
          type="button"
          onClick={scrollToTop}
          className="btn-secondary"
        >
          回到顶部
        </button>
      </div>
    </section>
  );
}
