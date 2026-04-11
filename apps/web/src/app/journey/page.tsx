"use client";

import { useReading } from "@/context/ReadingContext";
import JourneyView from "@/components/home/JourneyView";
import RitualInitializer from "@/components/home/RitualInitializer";

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
    <main className="mx-auto flex min-h-[92vh] max-w-5xl flex-col items-center justify-center px-6 pb-20 pt-24 lg:px-16">
      <header className="mb-16 space-y-4 text-center">
        <h1 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
          开启仪式
        </h1>
        <p className="mx-auto max-w-lg text-base text-text-muted">
          选择你的意图与牌阵，在静谧中开启这段向内的旅程。
        </p>
      </header>
      <RitualInitializer />
    </main>
  );
}
