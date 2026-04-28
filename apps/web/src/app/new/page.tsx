"use client";

import RitualInitializer from "@/components/home/RitualInitializer";

export default function NewReadingPage() {
  return (
    <main className="new-reading-workspace mx-auto flex w-full max-w-[1500px] flex-col px-4 py-3 sm:px-5 lg:px-6">
      <h1 className="fixed left-4 top-20 h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 text-[1px] leading-none text-transparent">
        开启你的仪式
      </h1>
      <div className="flex w-full min-h-0 flex-1 justify-center">
        <RitualInitializer />
      </div>
    </main>
  );
}
