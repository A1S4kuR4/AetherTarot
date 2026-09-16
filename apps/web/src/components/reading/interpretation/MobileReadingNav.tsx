"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ReadingNavItem } from "./constants";
import { useActiveReadingSection } from "./useActiveReadingSection";

interface MobileReadingNavProps {
  navItems: readonly ReadingNavItem[];
}

export function MobileReadingNav({ navItems }: MobileReadingNavProps) {
  const activeId = useActiveReadingSection(navItems);
  const trackRef = useRef<HTMLDivElement>(null);

  // Keep the active chapter discoverable in the horizontal track. Only the
  // nav container scrolls; the page and any manual horizontal swipe in the
  // reading body are left alone.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !activeId) return;

    const activeLink = track.querySelector<HTMLAnchorElement>(
      `a[href="#${CSS.escape(activeId)}"]`,
    );
    if (!activeLink) return;

    const targetLeft =
      activeLink.offsetLeft - (track.clientWidth - activeLink.offsetWidth) / 2;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeId]);

  return (
    <nav
      data-testid="mobile-reading-nav"
      className="sticky top-16 z-30 -mx-4 border-b border-paper-border bg-paper px-2 lg:hidden"
      aria-label="解读分段导航"
    >
      <div ref={trackRef} className="relative flex overflow-x-auto hide-scrollbar">
        {navItems.map((item, index) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={activeId === item.id ? "location" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center px-3 text-[13px] transition-colors hover:text-ink",
              activeId === item.id ? "text-text-accent" : "text-text-muted",
            )}
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
