"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/journey", label: "旅程", icon: "history" },
  { href: "/encyclopedia", label: "百科", icon: "auto_stories" },
  { href: "/login", label: "登录", icon: "login" },
] as const;

/**
 * Mobile-only slide-out drawer navigation.
 * Hidden on desktop; toggled via Topbar hamburger button.
 */
export default function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        id="mobile-sidebar-backdrop"
        className={cn(
          "fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        id="mobile-sidebar"
        className={cn(
          "fixed top-0 right-0 z-[70] flex h-full w-[min(18rem,86vw)] flex-col border-l border-paper-border bg-paper-raised p-6 pt-20 shadow-2xl transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className="absolute top-5 right-5 min-h-11 min-w-11 rounded-xl p-2 text-text-muted hover:bg-paper-muted"
          aria-label="关闭菜单"
          onClick={onClose}
        >
          <LegacyIcon name="close" className="text-xl" />
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
                onClick={onClose}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 font-sans text-sm font-medium transition-colors",
                  isActive
                    ? "bg-terracotta/10 text-terracotta"
                    : "text-text-body hover:bg-paper-muted",
                )}
              >
                <LegacyIcon name={item.icon} className="text-lg" />
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
