"use client";

import type { ReadingNavItem } from "./constants";

interface ReadingSidebarProps {
  spreadName: string;
  navItems: readonly ReadingNavItem[];
}

export function ReadingSidebar({ spreadName, navItems }: ReadingSidebarProps) {
  return (
    <>
      <div className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          阅读导航
        </p>
        <h4 className="mt-1 font-serif text-lg text-ink">使用牌阵：{spreadName}</h4>
        <nav
          className="mt-5 space-y-2"
          aria-label="解读阅读导航"
          data-testid="desktop-reading-nav"
        >
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block rounded-full border border-paper-border bg-paper px-4 py-2.5 text-sm font-medium text-text-muted transition hover:border-terracotta/30 hover:text-terracotta"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="rounded-xl border-l-2 border-terracotta/25 bg-terracotta/5 p-5">
        <p className="font-serif text-sm leading-relaxed text-text-muted">
          真理并不是被强行规定的结论，而是从你的处境中慢慢浮现的方向感。
        </p>
      </div>
    </>
  );
}
