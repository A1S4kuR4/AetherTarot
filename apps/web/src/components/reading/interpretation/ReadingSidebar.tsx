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
      <p className="font-serif text-lg text-ink">使用牌阵：{spreadName}</p>
      {coreMessage ? (
        <p className="mt-4 border-l-2 border-paper-border pl-3 font-serif text-[13px] leading-relaxed text-text-muted">
          {coreMessage}
        </p>
      ) : null}
      <nav
        className="mt-6"
        aria-label="解读阅读导航"
        data-testid="desktop-reading-nav"
      >
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="-mx-2 flex min-h-[36px] items-center rounded-md px-2 text-[13px] font-medium text-text-muted transition-colors hover:text-text-accent"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
