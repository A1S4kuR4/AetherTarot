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
  placeholder = "随着时间推移，牌意在现实中是如何展开的？写下你的感悟…",
  onChange,
  onSave,
}: NotesSectionProps) {
  return (
    <section id="reading-notes" className="scroll-mt-32">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-xl text-ink md:text-2xl">你的回望与觉察</h2>
        <p role="status" aria-live="polite" className="flex items-center gap-1 font-sans text-xs">
          {status === 'saving' && (
            <span className="flex items-center gap-1.5 text-text-muted">
              <span aria-hidden="true" className="block h-3 w-3 animate-spin rounded-full border-2 border-text-muted/20 border-t-text-muted motion-reduce:animate-none" />
              保存中…
            </span>
          )}
          {status === 'saved' && (
            <span className="flex items-center gap-1 text-success">
              <LegacyIcon name="check_circle" className="text-[14px]" />
              已保存
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-error">
              <LegacyIcon name="error" className="text-[14px]" />
              保存失败，请重试
            </span>
          )}
        </p>
      </div>
      <textarea
        name="reading_notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        autoComplete="off"
        aria-label="反思手记"
        placeholder={placeholder}
        className="mt-4 h-32 w-full resize-none rounded-xl border border-paper-border bg-paper-raised p-4 font-serif text-base leading-relaxed text-ink outline-none focus-visible:border-terracotta/50 focus-visible:ring-2 focus-visible:ring-terracotta/40"
      />
    </section>
  );
}
