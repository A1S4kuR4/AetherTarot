"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, LazyMotion, domAnimation } from "motion/react";
import { usePathname } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import { ReadingProvider } from "@/context/ReadingContext";

/** Routes that use Midnight Mode (dark immersive surface) */
const MIDNIGHT_ROUTES = ["/ritual", "/reveal", "/new"];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMidnight = MIDNIGHT_ROUTES.includes(pathname);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <ReadingProvider>
      <div
        className={
          isMidnight ? "midnight-surface min-h-screen" : "paper-surface min-h-screen"
        }
      >
        <Topbar
          isMidnight={isMidnight}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        />
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        <LazyMotion features={domAnimation}>
          <main className="pt-16">
            <AnimatePresence mode="wait">
              <m.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {children}
              </m.div>
            </AnimatePresence>
          </main>
        </LazyMotion>
      </div>
    </ReadingProvider>
  );
}
