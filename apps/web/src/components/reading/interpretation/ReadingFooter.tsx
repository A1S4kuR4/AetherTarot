"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";

interface ReadingFooterProps {
  onReset: () => void;
  onShare?: () => void;
}

export function ReadingFooter({ onReset, onShare }: ReadingFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="reading-card scroll-mt-32 bg-paper-raised">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
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
            <LegacyIcon name="share" className="text-[16px]" />
            分享
          </button>
        ) : null}
        <button
          type="button"
          onClick={scrollToTop}
          className="btn-secondary"
        >
          <LegacyIcon name="arrow_upward" className="text-[16px]" />
          回到顶部
        </button>
      </div>
    </section>
  );
}
