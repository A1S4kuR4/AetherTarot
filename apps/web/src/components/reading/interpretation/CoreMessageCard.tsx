"use client";

import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";
import type { PresentationMode } from "@aethertarot/shared-types";

interface CoreQuickRead {
  core: string;
  keywords: string[];
  action: string;
  boundary: string;
}

interface CoreMessageCardProps {
  quickRead: CoreQuickRead;
  presentationMode?: PresentationMode;
}

export function CoreMessageCard({ quickRead, presentationMode }: CoreMessageCardProps) {
  return (
    <section
      id="reading-quick"
      className={cn(
        "relative scroll-mt-32 rounded-3xl border p-5 shadow-sm md:my-8 md:p-8",
        presentationMode === "sober_anchor"
          ? "border-paper-border bg-paper"
          : "border-terracotta/15 bg-gradient-to-b from-paper-raised to-paper",
      )}
    >
      <div className="absolute left-5 top-0 flex -translate-y-1/2 items-center gap-2 rounded-full border border-paper-border bg-paper px-3 py-1 shadow-sm md:left-8">
        <LegacyIcon
          name="auto_awesome"
          className="text-[14px] text-terracotta/70"
        />
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
          此刻的核心讯息
        </span>
      </div>
      <div className="space-y-6">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            一句话看核心
          </p>
          <div className="max-w-[38rem]">
            <h2 className="mt-2 font-serif text-2xl leading-[1.45] text-ink md:text-[28px]">
              {quickRead.core}
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta/80">
              试着问自己
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-body">
              {quickRead.action}
            </p>
          </div>
          <div className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              请记住
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-body">
              {quickRead.boundary}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
