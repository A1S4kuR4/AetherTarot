"use client";

import { useEffect, useState } from "react";
import type { ReadingNavItem } from "./constants";

/**
 * Tracks which reading section currently sits in the reading band of the
 * viewport. Shared by the desktop sidebar and the mobile anchor nav so both
 * report the same active chapter.
 */
export function useActiveReadingSection(navItems: readonly ReadingNavItem[]) {
  const [activeId, setActiveId] = useState<string>(navItems[0]?.id ?? "");

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries.find((entry) => entry.isIntersecting);
      if (visibleEntry) {
        setActiveId(visibleEntry.target.id);
      }
    }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navItems]);

  return activeId;
}
