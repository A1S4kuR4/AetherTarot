"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import { ReadingProvider } from "@/context/ReadingContext";

/** Routes that use Midnight Mode (dark immersive surface) */
const MIDNIGHT_ROUTES = ["/ritual", "/reveal"];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMidnight = MIDNIGHT_ROUTES.includes(pathname);

  return (
    <ReadingProvider>
      <div
        className={
          isMidnight ? "midnight-surface min-h-screen" : "paper-surface min-h-screen"
        }
      >
        <Topbar isMidnight={isMidnight} />
        <Sidebar />

        <main className="min-h-screen pt-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ReadingProvider>
  );
}
