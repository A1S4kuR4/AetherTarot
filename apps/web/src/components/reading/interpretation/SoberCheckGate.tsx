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
    <div className="my-10 rounded-2xl border border-terracotta/30 bg-paper-raised p-6 md:p-10">
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
          className="h-32 w-full max-w-xl resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus-visible:border-terracotta/50 focus-visible:ring-2 focus-visible:ring-terracotta/40"
        />
      </label>
      <button
        type="button"
        disabled={!isValid}
        onClick={onConfirm}
        className="btn-primary mt-6 w-full max-w-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        确认并解开牌面
      </button>
    </div>
  );
}
