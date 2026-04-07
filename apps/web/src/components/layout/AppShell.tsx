"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { ReadingProvider } from "@/context/ReadingContext";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ReadingProvider>
      <div className="min-h-screen celestial-bg selection:bg-primary/30">
        <Sidebar />
        <Topbar />

        <main className="min-h-screen pt-20 md:pl-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="fixed right-8 bottom-8 z-50 flex gap-4">
          <div className="glass-panel flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant/20 text-secondary-fixed animate-pulse">
            <span className="material-symbols-outlined text-xl">
              auto_awesome
            </span>
          </div>
        </div>
      </div>
    </ReadingProvider>
  );
}
