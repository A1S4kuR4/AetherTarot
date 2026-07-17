"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";

interface SharePromptProps {
  onShare: () => void;
}

// In-content share entry placed right after the guidance section, where the
// reading has just landed emotionally — the footer button alone is too late.
export function SharePrompt({ onShare }: SharePromptProps) {
  return (
    <section className="reading-card flex flex-col items-center gap-2 py-8 text-center">
      <h2 className="font-serif text-xl text-ink">把这份觉察分享出去</h2>
      <p className="text-sm leading-relaxed text-text-muted">
        生成一张分享卡——牌阵卡不含你的问题，摘要卡可带走完整解读。
      </p>
      <button type="button" onClick={onShare} className="btn-secondary mt-3">
        <LegacyIcon name="share" className="text-[16px]" />
        分享这次解读
      </button>
    </section>
  );
}
