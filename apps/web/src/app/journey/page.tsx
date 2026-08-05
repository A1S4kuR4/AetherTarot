"use client";

import { useReading } from "@/context/ReadingContext";
import LegacyIcon from "@/components/ui/LegacyIcon";
import JourneyView from "@/components/home/JourneyView";
import NextLink from "next/link";

export default function JourneyPage() {
  const { history, isHydrated } = useReading();

  if (!isHydrated) return (
    <div className="flex min-h-screen items-center justify-center paper-surface">
      <div className="h-8 w-8 animate-spin border-2 border-paper-border border-t-terracotta" />
    </div>
  );

  if (history.length > 0) {
    return <JourneyView />;
  }

  return (
    <main className="mx-auto flex min-h-[92vh] max-w-5xl flex-col justify-center px-6 pb-24 pt-20 lg:px-16">
      <div className="mx-auto max-w-2xl border-y border-paper-border py-16 text-center">
        <p className="manuscript-label">
          JOURNEY · FIRST ENTRY
        </p>
        <LegacyIcon name="history_edu" className="mt-8 text-3xl text-terracotta/70" />
        <div className="mt-5 space-y-4">
          <h1 className="text-balance font-serif text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">
            记录尚未开启
          </h1>
          <p className="mx-auto max-w-xl text-base leading-8 text-text-muted">
            每一个回声都需要从一次真诚的询问开始。目前这里还没有你的占卜记录。
          </p>
        </div>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <NextLink href="/" className="min-h-11 border-b border-ink/30 px-1 py-2 text-sm text-ink transition-colors hover:border-terracotta hover:text-terracotta">
            阅读叙事导引
          </NextLink>
          <NextLink href="/new" className="inline-flex min-h-11 items-center border border-terracotta-ink bg-terracotta-ink px-5 py-2 font-serif text-sm text-paper transition-colors hover:bg-terracotta-active">
            开启第一次仪式
          </NextLink>
        </div>
      </div>
    </main>
  );
}
