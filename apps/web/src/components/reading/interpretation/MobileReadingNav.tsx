"use client";

import { MOBILE_READING_NAV_ITEMS } from "./constants";

export function MobileReadingNav() {
  return (
    <nav
      data-testid="mobile-reading-nav"
      className="sticky top-16 z-30 -mx-4 border-y border-paper-border bg-paper/95 px-4 py-2 backdrop-blur lg:hidden"
      aria-label="解读分段导航"
    >
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {MOBILE_READING_NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-paper-border bg-paper-raised px-3.5 text-xs font-medium text-text-muted"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
