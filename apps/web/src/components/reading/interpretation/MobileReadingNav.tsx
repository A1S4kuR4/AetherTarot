"use client";

import type { ReadingNavItem } from "./constants";

interface MobileReadingNavProps {
  navItems: readonly ReadingNavItem[];
}

export function MobileReadingNav({ navItems }: MobileReadingNavProps) {
  return (
    <nav
      data-testid="mobile-reading-nav"
      className="sticky top-16 z-30 -mx-4 border-b border-paper-border bg-paper px-2 lg:hidden"
      aria-label="解读分段导航"
    >
      <div className="flex overflow-x-auto hide-scrollbar">
        {navItems.map((item, index) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-11 shrink-0 items-center px-3 text-[13px] text-text-muted transition-colors hover:text-ink"
          >
            <span className="mr-1.5 font-mono text-[10px] text-terracotta-ink">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
