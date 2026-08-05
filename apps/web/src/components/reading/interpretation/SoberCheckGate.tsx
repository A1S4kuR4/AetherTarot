"use client";

interface SoberCheckGateProps {
  prompt: string;
  input: string;
  isValid: boolean;
  onInputChange: (value: string) => void;
  onConfirm: () => void;
}

export function SoberCheckGate({
  prompt,
  input,
  isValid,
  onInputChange,
  onConfirm,
}: SoberCheckGateProps) {
  return (
    <div className="my-10 border-y border-terracotta/30 py-8 md:py-10">
      <p className="manuscript-label">REALITY CHECK</p>
      <h2 className="font-serif text-2xl text-ink">
        降温与检视 (Sober Check)
      </h2>
      <p className="mt-4 max-w-xl text-base leading-[1.8] text-text-body">
        {prompt}
      </p>
      <label className="mt-6 block">
        <span className="sr-only">我的真实顾虑 / 底线计划</span>
        <textarea
          name="sober_check_reflection"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          autoComplete="off"
          placeholder="我的真实顾虑 / 底线计划是…"
          className="h-32 w-full max-w-xl resize-none border-y border-paper-border bg-transparent px-0 py-3 font-serif text-base text-ink outline-none focus-visible:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/20"
        />
      </label>
      <button
        type="button"
        disabled={!isValid}
        onClick={onConfirm}
        className="mt-6 min-h-11 w-full max-w-xs border border-terracotta-ink bg-terracotta-ink px-5 py-2 font-serif text-sm text-paper transition-colors hover:bg-terracotta-active disabled:cursor-not-allowed disabled:opacity-50"
      >
        确认并解开牌面
      </button>
    </div>
  );
}
