"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";

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
    <div className="reading-card my-16 flex flex-col items-center justify-center border-terracotta/40 bg-paper-raised/80 px-8 py-12 text-center shadow-sm">
      <LegacyIcon name="psychiatry" className="mb-6 text-4xl text-terracotta" />
      <h2 className="mb-4 font-serif text-2xl text-ink">
        降温与检视 (Sober Check)
      </h2>
      <p className="mb-8 max-w-lg text-base leading-[1.8] text-text-body">
        {prompt}
      </p>
      <textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="我的真实顾虑 / 底线计划是..."
        className="h-32 w-full max-w-xl resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
      />
      <button
        type="button"
        disabled={!isValid}
        onClick={onConfirm}
        className="btn-primary mt-8 w-full max-w-xs transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        确认并解开牌面
      </button>
    </div>
  );
}
