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
        "mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pb-24 pt-14",
        "sm:px-6 lg:flex-row lg:gap-16 lg:px-8 lg:pt-20",
      )}
    >
      <div className="w-full max-w-[760px] flex-1 space-y-10 sm:space-y-12 lg:space-y-16">
        {children}
      </div>
      <aside className="sticky top-24 hidden w-full shrink-0 self-start border-l border-paper-border pl-7 lg:block lg:w-[300px]">
        {sidebar}
      </aside>
    </div>
  );
}
