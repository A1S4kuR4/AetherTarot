"use client";

import type { ReadingNavItem } from "./constants";

interface MobileReadingNavProps {
  navItems: readonly ReadingNavItem[];
}

export function MobileReadingNav({ navItems }: MobileReadingNavProps) {
  return (
    <nav
      data-testid="mobile-reading-nav"
      className="sticky top-16 z-30 -mx-4 border-b border-paper-border/70 bg-paper/95 px-2 backdrop-blur lg:hidden"
      aria-label="解读分段导航"
    >
      <div className="flex overflow-x-auto hide-scrollbar">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-11 shrink-0 items-center px-3 text-[13px] font-medium text-text-muted transition-colors hover:text-ink"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
