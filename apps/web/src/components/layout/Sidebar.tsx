"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/journey", label: "旅程", icon: "history" },
  { href: "/encyclopedia", label: "百科", icon: "auto_stories" },
] as const;

/**
 * Mobile-only slide-out drawer navigation.
 * Hidden on desktop; toggled via Topbar hamburger button.
 */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        id="mobile-sidebar-backdrop"
        className="fixed inset-0 z-[60] hidden bg-ink/40 backdrop-blur-sm md:hidden"
        onClick={() => {
          document.getElementById("mobile-sidebar")?.classList.add("translate-x-full");
          document.getElementById("mobile-sidebar-backdrop")?.classList.add("hidden");
        }}
      />

      {/* Drawer */}
      <aside
        id="mobile-sidebar"
        className="fixed top-0 right-0 z-[70] flex h-full w-72 translate-x-full flex-col bg-paper-raised border-l border-paper-border p-8 pt-20 shadow-2xl transition-transform duration-300 ease-out md:hidden"
      >
        <button
          type="button"
          className="absolute top-5 right-5 rounded-xl p-2 text-text-muted hover:bg-paper-muted"
          aria-label="关闭菜单"
          onClick={() => {
            document.getElementById("mobile-sidebar")?.classList.add("translate-x-full");
            document.getElementById("mobile-sidebar-backdrop")?.classList.add("hidden");
          }}
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  document.getElementById("mobile-sidebar")?.classList.add("translate-x-full");
                  document.getElementById("mobile-sidebar-backdrop")?.classList.add("hidden");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 font-sans text-sm font-medium transition-colors",
                  isActive
                    ? "bg-terracotta/10 text-terracotta"
                    : "text-text-body hover:bg-paper-muted",
                )}
              >
                <span className="material-symbols-outlined text-lg">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-paper-border">
          <p className="text-xs text-text-muted leading-relaxed">
            本解读用于反思与启发，不替代医疗、法律、财务或其他专业建议。
          </p>
        </div>
      </aside>
    </>
  );
}
