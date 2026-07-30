"use client";

import { LOADING_STAGES } from "./constants";

interface LoadingStateProps {
  stageIndex: number;
}

export function LoadingState({ stageIndex }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center space-y-5 py-20"
    >
      <div
        aria-hidden="true"
        className="h-12 w-12 animate-spin rounded-full border-[3px] border-paper-border border-t-terracotta motion-reduce:animate-none"
      />
      <p className="font-serif text-lg text-text-muted">
        {LOADING_STAGES[stageIndex]?.title ?? LOADING_STAGES[0].title}
      </p>
      <p className="max-w-sm text-center text-sm leading-relaxed text-text-muted">
        {LOADING_STAGES[stageIndex]?.detail ?? LOADING_STAGES[0].detail}
      </p>
    </div>
  );
}
