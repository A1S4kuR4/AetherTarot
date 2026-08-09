"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  getRitualStartHoldProgress,
  RITUAL_START_HOLD_MS,
} from "./ritual-start-button";

interface RitualStartButtonProps {
  disabled: boolean;
  label: string;
  onComplete: (button: HTMLButtonElement) => void;
}

const COMPLETION_SETTLE_MS = 140;

export function RitualStartButton({
  disabled,
  label,
  onComplete,
}: RitualStartButtonProps) {
  const hintId = useId();
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef(0);
  const holdTimerRef = useRef(0);
  const resetTimerRef = useRef(0);
  const activePointerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const clearAnimationFrame = useCallback(() => {
    if (!animationFrameRef.current) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = 0;
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (!holdTimerRef.current) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = 0;
  }, []);

  const resetVisualState = useCallback(() => {
    clearAnimationFrame();
    clearHoldTimer();
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = 0;
    }
    activePointerRef.current = null;
    completedRef.current = false;
    setIsHolding(false);
    setProgress(0);
  }, [clearAnimationFrame, clearHoldTimer]);

  const completeHold = useCallback((button: HTMLButtonElement) => {
    if (completedRef.current || disabled) return;
    clearAnimationFrame();
    clearHoldTimer();
    completedRef.current = true;
    setProgress(1);
    onComplete(button);
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = 0;
      completedRef.current = false;
      setIsHolding(false);
      setProgress(0);
    }, COMPLETION_SETTLE_MS);
  }, [clearAnimationFrame, clearHoldTimer, disabled, onComplete]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    resetVisualState();
    activePointerRef.current = event.pointerId;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsHolding(true);

    const button = event.currentTarget;
    const startedAt = performance.now();
    holdTimerRef.current = window.setTimeout(
      () => completeHold(button),
      RITUAL_START_HOLD_MS,
    );
    const update = (now: number) => {
      const nextProgress = getRitualStartHoldProgress(
        startedAt,
        now,
        RITUAL_START_HOLD_MS,
      );
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(update);
    };
    animationFrameRef.current = window.requestAnimationFrame(update);
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerRef.current = null;
    if (!completedRef.current) resetVisualState();
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse" || completedRef.current) return;
    finishPointerInteraction(event);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) {
      event.preventDefault();
      return;
    }
    completeHold(event.currentTarget);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    completeHold(event.currentTarget);
  };

  useEffect(() => resetVisualState, [resetVisualState]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={(event) => {
          if (!completedRef.current && activePointerRef.current === event.pointerId) {
            resetVisualState();
          }
        }}
        onPointerCancel={finishPointerInteraction}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerUp={finishPointerInteraction}
        className={`new-reading-start-button${isHolding ? " new-reading-start-button-holding" : ""}`}
      >
        <span
          aria-hidden="true"
          className="new-reading-start-progress"
          style={{ transform: `scaleX(${progress})` }}
        />
        <span className="new-reading-start-label">
          {isHolding && progress < 1 ? "继续按住，确认问询" : label}
        </span>
      </button>
      <span id={hintId} className="sr-only">
        指针或触控请按住约 0.7 秒；键盘与辅助技术可直接激活。
      </span>
    </>
  );
}
