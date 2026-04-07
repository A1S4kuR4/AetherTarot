"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const secondaryNav = [
  { href: "/history", label: "History" },
  { href: "/encyclopedia", label: "Encyclopedia" },
] as const;

export default function Topbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 z-50 flex h-20 w-full items-center justify-between bg-background/60 px-6 shadow-[0_4px_30px_rgba(228,225,237,0.06)] backdrop-blur-xl md:px-8">
      <Link
        href="/"
        className="font-serif text-2xl italic text-primary drop-shadow-[0_0_8px_rgba(203,190,255,0.4)]"
      >
        AetherTarot
      </Link>

      <div className="hidden items-center gap-8 font-label tracking-wide md:flex">
        {secondaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors duration-500",
              pathname === item.href
                ? "text-secondary-fixed"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/history"
          className="rounded-full p-2 transition-all duration-300 hover:bg-surface-container-highest/40 md:hidden"
        >
          <span className="material-symbols-outlined text-primary">history</span>
        </Link>
        <button
          type="button"
          className="rounded-full p-2 transition-all duration-300 hover:bg-surface-container-highest/40"
        >
          <span className="material-symbols-outlined text-primary">
            account_circle
          </span>
        </button>
      </div>
    </nav>
  );
}
