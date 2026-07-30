"use client";

import { cn } from "@/lib/utils";

interface ReadingLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function ReadingLayout({ children, sidebar }: ReadingLayoutProps) {
  return (
    <div
      id="reading-main"
      tabIndex={-1}
      className={cn(
        "mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-14",
        "sm:px-6 lg:flex-row lg:gap-14 lg:px-16 lg:pt-20",
      )}
    >
      <div className="w-full max-w-[720px] flex-1 space-y-12">
        {children}
      </div>
      <aside className="sticky top-24 hidden w-full self-start lg:block lg:w-64">
        {sidebar}
      </aside>
    </div>
  );
}
