import { toCanvas } from "html-to-image";
import { getBurnPixelRatio } from "./page-burn-transition";

const SNAPSHOT_SELECTOR = "[data-page-burn-snapshot]";

export async function captureBurnSnapshot(): Promise<HTMLCanvasElement> {
  const target = document.querySelector<HTMLElement>(SNAPSHOT_SELECTOR);
  if (!target) {
    throw new Error("Page burn snapshot target is unavailable.");
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = getBurnPixelRatio(width, height, window.devicePixelRatio);

  return toCanvas(target, {
    width,
    height,
    pixelRatio,
    backgroundColor: "#F5F2E8",
    cacheBust: false,
    skipFonts: true,
    style: {
      height: `${height}px`,
      maxHeight: `${height}px`,
      overflow: "hidden",
      width: `${width}px`,
    },
  });
}
