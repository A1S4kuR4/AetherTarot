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

  return (
    <ReadingProvider>
      <RouteShell key={pathname} pathname={pathname}>
        {children}
      </RouteShell>
    </ReadingProvider>
  );
}

function RouteShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shouldReduceRouteMotion, setShouldReduceRouteMotion] = useState(false);
  const isMidnight = MIDNIGHT_ROUTES.includes(pathname);

  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 767px)");
    const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setShouldReduceRouteMotion(mobileMedia.matches || reducedMotionMedia.matches);
    };

    update();
    mobileMedia.addEventListener("change", update);
    reducedMotionMedia.addEventListener("change", update);

    return () => {
      mobileMedia.removeEventListener("change", update);
      reducedMotionMedia.removeEventListener("change", update);
    };
  }, []);

  return (
    <div
      data-route-motion={shouldReduceRouteMotion ? "reduced" : "standard"}
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
              initial={shouldReduceRouteMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceRouteMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={shouldReduceRouteMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
            >
              {children}
            </m.div>
          </AnimatePresence>
        </main>
      </LazyMotion>
    </div>
  );
}
