"use client";

import LegacyIcon from "@/components/ui/LegacyIcon";

interface NotesSectionProps {
  value: string;
  status: 'idle' | 'saving' | 'saved' | 'error';
  placeholder?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function NotesSection({
  value,
  status,
  placeholder = "随着时间推移，牌意在现实中是如何展开的？写下你的感悟...",
  onChange,
  onSave,
}: NotesSectionProps) {
  return (
    <section
      id="reading-notes"
      className="reading-card scroll-mt-32 bg-paper-raised"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            反思手记
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink">你的回望与觉察</h2>
        </div>
        {status === 'saving' && (
          <span className="flex items-center gap-1 font-sans text-xs text-text-muted opacity-80">
            <div className="w-3 h-3 border-2 border-text-muted/20 border-t-text-muted rounded-full animate-spin" />
            保存中...
          </span>
        )}
        {status === 'saved' && (
          <span className="flex items-center gap-1 font-sans text-xs text-terracotta opacity-80">
            <LegacyIcon name="check_circle" className="text-[14px]" />
            已保存
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1 font-sans text-xs text-error opacity-80">
            <LegacyIcon name="error" className="text-[14px]" />
            保存失败，请重试
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        placeholder={placeholder}
        className="h-32 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base leading-relaxed text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
      />
    </section>
  );
}
