"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BurnIgnition } from "./page-burn-transition";

export type PageBurnTransitionState =
  | { phase: "idle" }
  | { phase: "capturing" }
  | {
      phase: "burning";
      ignition: BurnIgnition;
      seed: number;
      snapshot: HTMLCanvasElement;
      targetPath: string;
    };

interface IgniteInput {
  ignition: BurnIgnition;
  snapshot: HTMLCanvasElement;
  targetPath: string;
}

interface PageBurnTransitionContextValue {
  state: PageBurnTransitionState;
  beginCapture: () => boolean;
  cancel: () => void;
  complete: () => void;
  ignite: (input: IgniteInput) => void;
}

export const PageBurnTransitionContext =
  createContext<PageBurnTransitionContextValue | null>(null);

export function PageBurnTransitionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageBurnTransitionState>({ phase: "idle" });
  const isActiveRef = useRef(false);
  const isActive = state.phase !== "idle";

  const beginCapture = useCallback(() => {
    if (isActiveRef.current) return false;
    isActiveRef.current = true;
    setState({ phase: "capturing" });
    return true;
  }, []);

  const reset = useCallback(() => {
    isActiveRef.current = false;
    setState({ phase: "idle" });
  }, []);

  const ignite = useCallback(({ ignition, snapshot, targetPath }: IgniteInput) => {
    if (!isActiveRef.current) return;
    setState({
      phase: "burning",
      ignition,
      seed: Math.random() * 100,
      snapshot,
      targetPath,
    });
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isActive]);

  const value = useMemo(
    () => ({
      state,
      beginCapture,
      cancel: reset,
      complete: reset,
      ignite,
    }),
    [beginCapture, ignite, reset, state],
  );

  return (
    <PageBurnTransitionContext.Provider value={value}>
      {children}
    </PageBurnTransitionContext.Provider>
  );
}
