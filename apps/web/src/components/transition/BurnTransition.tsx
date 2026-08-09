"use client";

import { animate, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { BurnWebGLRenderer } from "./BurnWebGLRenderer";
import { getBurnPixelRatio, type BurnIgnition } from "./page-burn-transition";

interface BurnTransitionProps {
  duration?: number;
  ignition: BurnIgnition;
  navigateAt?: number;
  onComplete: () => void;
  onError: () => void;
  onNavigate: () => void;
  seed: number;
  snapshot: HTMLCanvasElement;
}

export function BurnTransition({
  duration = 1800,
  ignition,
  // Mount the target beneath the snapshot before the first opening grows visible.
  navigateAt = 0.05,
  onComplete,
  onError,
  onNavigate,
  seed,
  snapshot,
}: BurnTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progress = useMotionValue(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: BurnWebGLRenderer;
    let animationFrame = 0;
    let isMounted = true;
    let hasNavigated = false;
    const startedAt = performance.now();

    const navigateOnce = () => {
      if (hasNavigated || !isMounted) return;
      hasNavigated = true;
      onNavigate();
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (isMounted) onError();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    try {
      const ratio = getBurnPixelRatio(
        window.innerWidth,
        window.innerHeight,
        window.devicePixelRatio,
      );
      canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
      canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
      renderer = new BurnWebGLRenderer(canvas, snapshot, ignition, seed);
      renderer.render({ progress: 0, time: 0 });
    } catch {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      onError();
      return;
    }

    const unsubscribe = progress.on("change", (latest) => {
      if (latest >= navigateAt) navigateOnce();
    });
    const controls = animate(progress, 1, {
      duration: duration / 1000,
      ease: [0.45, 0, 0.55, 1],
    });

    const renderFrame = (now: number) => {
      renderer.render({
        progress: progress.get(),
        time: (now - startedAt) / 1000,
      });
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    animationFrame = window.requestAnimationFrame(renderFrame);

    controls.then(() => {
      if (!isMounted) return;
      navigateOnce();
      renderer.render({ progress: 1, time: (performance.now() - startedAt) / 1000 });
      onComplete();
    });

    return () => {
      isMounted = false;
      controls.stop();
      unsubscribe();
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      renderer.dispose();
    };
  }, [duration, ignition, navigateAt, onComplete, onError, onNavigate, progress, seed, snapshot]);

  return <canvas ref={canvasRef} className="page-burn-transition-canvas" aria-hidden="true" />;
}
