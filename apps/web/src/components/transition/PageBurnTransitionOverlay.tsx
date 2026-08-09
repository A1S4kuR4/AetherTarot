"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { BurnTransition } from "./BurnTransition";
import { usePageBurnTransition } from "./usePageBurnTransition";

export function PageBurnTransitionOverlay() {
  const router = useRouter();
  const { state, cancel, complete } = usePageBurnTransition();
  const fallbackHandledRef = useRef(false);
  const isActive = state.phase !== "idle";

  useEffect(() => {
    if (state.phase === "capturing") fallbackHandledRef.current = false;
  }, [state.phase]);

  const handleError = useCallback(() => {
    if (state.phase !== "burning" || fallbackHandledRef.current) return;
    fallbackHandledRef.current = true;
    router.push(state.targetPath);
    cancel();
  }, [cancel, router, state]);

  const handleComplete = useCallback(() => {
    fallbackHandledRef.current = false;
    complete();
  }, [complete]);

  const handleNavigate = useCallback(() => {
    if (state.phase === "burning") router.push(state.targetPath);
  }, [router, state]);

  return (
    <AnimatePresence>
      {isActive ? (
        <motion.div
          key="page-burn-transition"
          className="page-burn-transition-overlay"
          data-phase={state.phase}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          aria-hidden="true"
        >
          {state.phase === "burning" ? (
            <BurnTransition
              ignition={state.ignition}
              onComplete={handleComplete}
              onError={handleError}
              onNavigate={handleNavigate}
              seed={state.seed}
              snapshot={state.snapshot}
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
