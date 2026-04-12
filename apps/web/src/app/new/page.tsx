"use client";

import RitualInitializer from "@/components/home/RitualInitializer";

export default function NewReadingPage() {
  return (
    <main className="mx-auto flex min-h-[92vh] max-w-5xl flex-col items-center justify-center px-6 pb-4 pt-8 lg:px-16">
      <header className="mb-4 space-y-2 text-center">
        <h1 className="font-serif text-3xl font-semibold text-text-inverse md:text-4xl">
          开启你的仪式
        </h1>
        <p className="mx-auto max-w-lg text-sm text-text-inverse-muted">
          收束意念，向内心发起询问。塔罗是一面镜子，映照出你此刻的立场与潜流。
        </p>
      </header>
      
      <div className="w-full flex justify-center">
        <RitualInitializer />
      </div>
    </main>
  );
}
