"use client";

import RitualInitializer from "@/components/home/RitualInitializer";

export default function NewReadingPage() {
  return (
    <main className="new-reading-workspace relative mx-auto flex w-full max-w-[1500px] flex-col px-4 py-3 sm:px-5 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden lg:px-6 max-lg:min-h-[calc(100dvh-4rem)] max-lg:overflow-y-auto max-lg:pb-12">
      {/* Dual Nebula Ambient Glow Backdrops */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(113,112,255,0.14),transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(214,107,61,0.12),transparent_70%)] blur-3xl" />
      <h1 className="fixed left-4 top-20 h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 text-[1px] leading-none text-transparent">
        开启你的仪式
      </h1>
      <div className="flex w-full min-h-0 flex-1 justify-center">
        <RitualInitializer />
      </div>
    </main>
  );
}
