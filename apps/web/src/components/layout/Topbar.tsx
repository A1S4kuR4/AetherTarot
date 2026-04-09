"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", englishLabel: "Home" },
  { href: "/history", label: "历史", englishLabel: "History" },
  { href: "/encyclopedia", label: "百科", englishLabel: "Encyclopedia" },
] as const;

export default function Topbar({ isMidnight = false }: { isMidnight?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 flex h-16 w-full items-center justify-between px-6 transition-colors duration-300 md:px-10",
        isMidnight
          ? "bg-night/80 backdrop-blur-md border-b border-midnight-border"
          : "bg-paper/80 backdrop-blur-md border-b border-paper-border",
      )}
    >
      {/* Logo */}
      <Link
        href="/"
        className={cn(
          "font-serif text-xl font-semibold tracking-tight transition-colors",
          isMidnight ? "text-text-inverse" : "text-ink",
        )}
      >
        灵语塔罗
      </Link>

      {/* Desktop Navigation */}
      <div className="hidden items-center gap-8 md:flex">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "font-sans text-[13px] font-medium tracking-wide transition-colors duration-200",
                isActive
                  ? isMidnight
                    ? "text-text-inverse"
                    : "text-terracotta"
                  : isMidnight
                    ? "text-text-inverse-muted hover:text-text-inverse"
                    : "text-text-muted hover:text-text-strong",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile menu button */}
      <button
        type="button"
        className={cn(
          "rounded-xl p-2 transition-colors md:hidden",
          isMidnight
            ? "text-text-inverse hover:bg-midnight-elevated"
            : "text-text-muted hover:bg-paper-muted",
        )}
        aria-label="打开菜单"
        onClick={() => {
          const sidebar = document.getElementById("mobile-sidebar");
          sidebar?.classList.toggle("translate-x-full");
        }}
      >
        <span className="material-symbols-outlined text-xl">menu</span>
      </button>
    </nav>
  );
}
