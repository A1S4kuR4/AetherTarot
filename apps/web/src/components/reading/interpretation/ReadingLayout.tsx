"use client";

import { cn } from "@/lib/utils";

interface ReadingLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function ReadingLayout({ children, sidebar }: ReadingLayoutProps) {
  return (
    <main
      className={cn(
        "mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-20",
        "sm:px-6 lg:flex-row lg:gap-12 lg:px-16 lg:pt-24",
      )}
    >
      <div className="flex-1 space-y-10" style={{ maxWidth: "760px" }}>
        {children}
      </div>
      <aside className="sticky top-24 hidden w-full space-y-6 self-start lg:block lg:w-72">
        {sidebar}
      </aside>
    </main>
  );
}
