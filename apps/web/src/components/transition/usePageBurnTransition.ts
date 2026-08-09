"use client";

import { useContext } from "react";
import { PageBurnTransitionContext } from "./PageBurnTransitionProvider";

export function usePageBurnTransition() {
  const context = useContext(PageBurnTransitionContext);
  if (!context) {
    throw new Error("usePageBurnTransition must be used within PageBurnTransitionProvider.");
  }
  return context;
}
