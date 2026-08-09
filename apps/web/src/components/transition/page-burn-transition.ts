export interface BurnIgnition {
  x: number;
  y: number;
}

const MAX_RENDER_WIDTH = 1600;
const MAX_RENDER_HEIGHT = 1200;
const MAX_PIXEL_RATIO = 1.5;

export function getBurnIgnition(
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewportWidth: number,
  viewportHeight: number,
): BurnIgnition {
  const x = (rect.left + rect.width / 2) / viewportWidth;
  const y = 1 - (rect.top + rect.height / 2) / viewportHeight;

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

export function getBurnPixelRatio(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
): number {
  return Math.min(
    Math.max(devicePixelRatio, 1),
    MAX_PIXEL_RATIO,
    MAX_RENDER_WIDTH / viewportWidth,
    MAX_RENDER_HEIGHT / viewportHeight,
  );
}

export function canUsePageBurnTransition(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(max-width: 767px)").matches) return false;
  if (window.matchMedia("(max-height: 700px)").matches) return false;

  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}
