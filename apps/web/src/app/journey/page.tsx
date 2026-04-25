"use client";

import { useReading } from "@/context/ReadingContext";
import LegacyIcon from "@/components/ui/LegacyIcon";
import JourneyView from "@/components/home/JourneyView";
import NextLink from "next/link";

export default function JourneyPage() {
  const { history, isHydrated } = useReading();

  if (!isHydrated) return (
    <div className="flex min-h-screen items-center justify-center paper-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-terracotta/20 border-t-terracotta" />
    </div>
  );

  if (history.length > 0) {
    return <JourneyView />;
  }

  return (
    <main className="mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-6 text-center">
      <div className="space-y-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-paper-raised border border-paper-border text-text-placeholder">
          <LegacyIcon name="history_edu" className="text-4xl" />
        </div>
        <div className="space-y-4">
          <h1 className="font-serif text-3xl font-semibold text-ink md:text-4xl">
            记录尚未开启
          </h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-text-muted">
            每一个回声都需要从一次真诚的询问开始。目前这里还没有你的占卜记录。
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <NextLink href="/" className="btn-secondary px-8 py-3.5">
            阅读叙事导引
          </NextLink>
          <NextLink href="/new" className="btn-primary px-8 py-3.5">
            开启第一次仪式
          </NextLink>
        </div>
      </div>
    </main>
  );
}
