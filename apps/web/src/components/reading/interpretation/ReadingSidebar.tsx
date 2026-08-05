"use client";

import type { ReadingNavItem } from "./constants";

interface ReadingSidebarProps {
  spreadName: string;
  navItems: readonly ReadingNavItem[];
  coreMessage?: string | null;
}

export function ReadingSidebar({ spreadName, navItems, coreMessage }: ReadingSidebarProps) {
  return (
    <div>
      <p className="manuscript-label">READING INDEX</p>
      <p className="mt-3 font-serif text-lg text-ink">使用牌阵：{spreadName}</p>
      {coreMessage ? (
        <p className="mt-5 border-l border-terracotta/60 pl-4 font-serif text-[13px] leading-7 text-text-muted">
          {coreMessage}
        </p>
      ) : null}
      <nav
        className="mt-7 border-t border-paper-border pt-4"
        aria-label="解读阅读导航"
        data-testid="desktop-reading-nav"
      >
          <ul className="space-y-1">
          {navItems.map((item, index) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="-mx-1 flex min-h-[36px] items-center gap-3 px-1 text-[13px] text-text-muted transition-colors hover:text-text-accent"
              >
                <span className="font-mono text-[10px] text-terracotta-ink">{String(index + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
