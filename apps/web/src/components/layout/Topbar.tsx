"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const navItems = [
  { href: "/", label: "首页", englishLabel: "Home" },
  { href: "/journey", label: "旅程", englishLabel: "Journey" },
  { href: "/encyclopedia", label: "百科", englishLabel: "Encyclopedia" },
] as const;

export default function Topbar({
  isMidnight = false,
  isMobileMenuOpen = false,
  onMobileMenuToggle,
}: {
  isMidnight?: boolean;
  isMobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <>
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

          {status === "authenticated" ? (
            <div className="flex items-center gap-4">
              {session?.user?.email && (
                <span
                  className={cn(
                    "font-sans text-[13px] font-medium tracking-wide opacity-80",
                    isMidnight ? "text-text-inverse-muted" : "text-text-muted",
                  )}
                >
                  {session.user.email}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className={cn(
                  "font-sans text-[13px] font-medium tracking-wide transition-colors duration-200",
                  isMidnight
                    ? "text-text-inverse-muted hover:text-text-inverse"
                    : "text-text-muted hover:text-text-strong",
                )}
              >
                登出
              </button>
            </div>
          ) : status === "unauthenticated" ? (
            <Link
              href="/login"
              className={cn(
                "font-sans text-[13px] font-medium tracking-wide transition-colors duration-200",
                pathname === "/login"
                  ? isMidnight
                    ? "text-text-inverse"
                    : "text-terracotta"
                  : isMidnight
                    ? "text-text-inverse-muted hover:text-text-inverse"
                    : "text-text-muted hover:text-text-strong",
              )}
            >
              登录
            </Link>
          ) : null}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className={cn(
            "min-h-11 min-w-11 rounded-xl p-2 transition-colors md:hidden",
            isMidnight
              ? "text-text-inverse hover:bg-midnight-elevated"
              : "text-text-muted hover:bg-paper-muted",
          )}
          aria-label="打开菜单"
          aria-controls="mobile-sidebar"
          aria-expanded={isMobileMenuOpen}
          onClick={onMobileMenuToggle}
        >
          <LegacyIcon name="menu" className="text-xl" />
        </button>
      </nav>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="退出登录"
        description="确定要退出登录吗？退出后需要重新输入账号密码。"
        confirmLabel="退出登录"
        cancelLabel="取消"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        isMidnight={isMidnight}
      />
    </>
  );
}
