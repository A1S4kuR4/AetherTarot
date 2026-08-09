"use client";

interface SharePromptProps {
  onShare: (trigger: HTMLButtonElement) => void;
}

// Quiet in-content share entry inside the "关于这次解读" group — sharing is a
// secondary action and must not interrupt the main reading rhythm.
export function SharePrompt({ onShare }: SharePromptProps) {
  return (
    <section aria-label="分享这次解读" className="border-t border-paper-border/60 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[30rem] text-sm leading-relaxed text-text-muted">
          生成一张分享卡——牌阵卡不含你的问题，摘要卡可带走完整解读。
        </p>
        <button
          type="button"
          onClick={(event) => {
            // Safari/WebKit does not focus buttons on pointer click by default.
            // Establish the trigger explicitly so the modal can return focus.
            event.currentTarget.focus({ preventScroll: true });
            onShare(event.currentTarget);
          }}
          className="btn-secondary shrink-0"
        >
          分享这次解读
        </button>
      </div>
    </section>
  );
}
