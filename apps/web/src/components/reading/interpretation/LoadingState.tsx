"use client";

import { LOADING_STAGES } from "./constants";

interface LoadingStateProps {
  stageIndex: number;
}

export function LoadingState({ stageIndex }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-5 py-20">
      <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-paper-border border-t-terracotta" />
      <p className="font-serif text-lg text-text-muted">
        {LOADING_STAGES[stageIndex]?.title ?? LOADING_STAGES[0].title}
      </p>
      <p className="max-w-sm text-center text-sm leading-relaxed text-text-muted/80">
        {LOADING_STAGES[stageIndex]?.detail ?? LOADING_STAGES[0].detail}
      </p>
    </div>
  );
}
