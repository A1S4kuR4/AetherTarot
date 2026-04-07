"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Inquiry", icon: "auto_awesome" },
  { href: "/ritual", label: "Ritual", icon: "style" },
  { href: "/reveal", label: "Reveal", icon: "visibility" },
  { href: "/reading", label: "Reading", icon: "auto_stories" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-full w-24 flex-col items-center justify-center gap-12 border-r border-outline-variant/10 bg-surface-container-low/40 py-24 backdrop-blur-md md:flex">
      <div className="absolute top-8 flex flex-col items-center gap-1">
        <span className="material-symbols-outlined text-xl text-secondary-fixed">
          stars
        </span>
      </div>

      <nav className="flex flex-col gap-10">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex flex-col items-center gap-2 transition-all duration-500 ease-in-out",
                isActive
                  ? "scale-110 text-secondary-fixed drop-shadow-[0_0_10px_rgba(233,196,0,0.5)]"
                  : "text-outline-variant hover:text-primary",
              )}
            >
              <span className="material-symbols-outlined text-2xl">
                {item.icon}
              </span>
              <span className="font-label text-[10px] uppercase tracking-[0.2em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pb-8">
        <div className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant/30">
          <img
            alt="User Profile"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6WnnsSpR4-nVZumwdLvhtNWjs_lT-hPBVD2OFKZfSvzFU32TvAC7gVuH8zRzfky7HLynbZMAJ_MlZ-XO3fTxbkWOcFT1b4x-cP0AUZqADjEm7EJI026kHPJZSukyd-upQ77z6lEj5w5_sJJr1foOjW6J5E3HSCgMEPtpewRJYa8ZUFjn8x7jz0pewgJBju-nOYPPTzLouTHyjCCuTr_jwyab2UJHtJsqaP7ZsYgueANfssUnKjU50cWqlAuIdLwL2qzzBjspEysJK"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </aside>
  );
}
