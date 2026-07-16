import { toBlob } from "html-to-image";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
} from "./constants";

export interface GenerateImageOptions {
  scale?: number;
  backgroundColor?: string;
  signal?: AbortSignal;
}

const FONT_LOAD_TIMEOUT_MS = 5_000;
const IMAGE_DECODE_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 30_000;
const SHARE_FONT_STYLESHEET_URL = "/fonts/aether-serif/aether-serif.css";
const SHARE_FONT_EMBED_URL = "/fonts/aether-serif/aether-serif-share-embed.css";

let fontStylesheetPromise: Promise<void> | null = null;
let cachedFontEmbedCSS: string | null = null;

export class ShareImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareImageError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ShareImageError(`${label} 超时，请稍后重试。`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function ensureShareFontStylesheet(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  const existingLink = document.querySelector<HTMLLinkElement>(
    'link[data-font="aether-serif"]',
  );
  if (existingLink?.sheet) {
    return Promise.resolve();
  }
  if (fontStylesheetPromise) {
    return fontStylesheetPromise;
  }

  fontStylesheetPromise = withTimeout(
    new Promise<void>((resolve, reject) => {
      const link = existingLink ?? document.createElement("link");
      const handleLoad = () => resolve();
      const handleError = () => reject(new ShareImageError("字体样式加载失败"));

      link.addEventListener("load", handleLoad, { once: true });
      link.addEventListener("error", handleError, { once: true });

      if (!existingLink) {
        link.rel = "stylesheet";
        link.href = SHARE_FONT_STYLESHEET_URL;
        link.setAttribute("data-font", "aether-serif");
        document.head.appendChild(link);
      }
    }),
    FONT_LOAD_TIMEOUT_MS,
    "字体样式加载",
  ).catch((error) => {
    fontStylesheetPromise = null;
    throw error;
  });

  return fontStylesheetPromise;
}

export async function prepareFonts(text = "灵语塔罗"): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  try {
    await ensureShareFontStylesheet();
    await withTimeout(
      document.fonts.load(`400 ${SHARE_CARD_WIDTH / 25}px AetherSerif`, text),
      FONT_LOAD_TIMEOUT_MS,
      "字体加载",
    );
    await withTimeout(document.fonts.ready, FONT_LOAD_TIMEOUT_MS, "字体就绪");
  } catch {
    // Fallback is acceptable; continue with system fonts.
  }
}

async function loadShareFontEmbedCSS(): Promise<string | null> {
  if (cachedFontEmbedCSS) {
    return cachedFontEmbedCSS;
  }

  try {
    const css = await withTimeout(
      (async () => {
        const response = await fetch(SHARE_FONT_EMBED_URL);
        if (!response.ok) {
          throw new ShareImageError("字体内嵌样式不可用");
        }
        return response.text();
      })(),
      FONT_LOAD_TIMEOUT_MS,
      "字体内嵌样式加载",
    );

    if (!css.includes("data:font/woff2;base64,") || /url\(["']?\.\//.test(css)) {
      throw new ShareImageError("字体内嵌样式格式无效");
    }

    cachedFontEmbedCSS = css;
    return css;
  } catch {
    // Use the system serif fallback instead of rediscovering every web-font shard.
    return null;
  }
}

async function decodeImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) {
    try {
      await img.decode();
    } catch {
      // Ignore decode errors for already-loaded images.
    }
    return;
  }

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new ShareImageError("图片加载失败"));
    }),
    IMAGE_DECODE_TIMEOUT_MS,
    "图片加载",
  );
}

export async function prepareImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      try {
        await decodeImage(img);
      } catch {
        // Leave broken images as-is; html-to-image will use naturalWidth if available.
      }
    }),
  );
}

export async function generateShareImage(
  node: HTMLElement,
  options: GenerateImageOptions = {},
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new ShareImageError("只能在浏览器环境中生成图片");
  }

  const { signal } = options;

  if (signal?.aborted) {
    throw new ShareImageError("用户已取消");
  }

  await prepareFonts(node.textContent ?? "灵语塔罗");

  if (signal?.aborted) {
    throw new ShareImageError("用户已取消");
  }

  await prepareImages(node);

  if (signal?.aborted) {
    throw new ShareImageError("用户已取消");
  }

  const fontEmbedCSS = await loadShareFontEmbedCSS();

  if (signal?.aborted) {
    throw new ShareImageError("用户已取消");
  }

  const htmlToImageOptions: Parameters<typeof toBlob>[1] = {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    pixelRatio: options.scale ?? SHARE_CARD_PIXEL_RATIO,
    backgroundColor: options.backgroundColor ?? "#F5F2E8",
    cacheBust: false,
    skipFonts: fontEmbedCSS === null,
    fontEmbedCSS: fontEmbedCSS ?? undefined,
  };

  const blob = await withTimeout(
    toBlob(node, htmlToImageOptions),
    GENERATION_TIMEOUT_MS,
    "图片生成",
  );

  if (!blob) {
    throw new ShareImageError("图片生成失败，请重试");
  }

  return blob;
}

export function blobToFile(blob: Blob, fileName = "aether-tarot-share.png"): File {
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([], "", { type: "image/png" })] })
  );
}

export async function shareImageFile(file: File): Promise<void> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    throw new ShareImageError("当前浏览器不支持系统分享");
  }

  try {
    await navigator.share({
      title: "灵语塔罗",
      text: "看看我的塔罗解读",
      files: [file],
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    throw new ShareImageError("分享失败，请尝试下载图片");
  }
}

export function downloadImageBlob(blob: Blob, fileName = "aether-tarot-share.png"): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Keep the URL alive briefly to ensure the download starts.
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string | null): void {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

// Text truncation utilities --------------------------------------------------

const CJK_SENTENCE_ENDINGS = new Set(["。", "？", "！", "；", "\n", "："]);
const TRUNCATION_ELLIPSIS = "…";

function getSegmenter(): Intl.Segmenter | null {
  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      return new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
    }
  } catch {
    // Ignore unsupported environments.
  }
  return null;
}

function countGraphemeClusters(text: string): number {
  const segmenter = getSegmenter();
  if (!segmenter) {
    return Array.from(text).length;
  }
  return Array.from(segmenter.segment(text)).length;
}

function sliceByGraphemeClusters(text: string, count: number): string {
  const segmenter = getSegmenter();
  if (!segmenter) {
    return Array.from(text).slice(0, count).join("");
  }
  return Array.from(segmenter.segment(text))
    .slice(0, count)
    .map((segment) => segment.segment)
    .join("");
}

export function truncateByCharBudget(text: string, maxChars: number): string {
  if (countGraphemeClusters(text) <= maxChars) {
    return text;
  }

  let boundaryIndex = -1;

  // Prefer stopping after a sentence boundary within the last 12 grapheme clusters.
  const segmenter = getSegmenter();
  const segments = segmenter
    ? Array.from(segmenter.segment(text))
    : Array.from(text).map((char) => ({ segment: char, index: 0, isWordLike: false }));
  const searchStart = Math.max(0, maxChars - 12);
  for (let i = maxChars - 1; i >= searchStart; i--) {
    const segment = segments[i];
    if (!segment) continue;
    const char = typeof segment === "string" ? segment : segment.segment;
    if (CJK_SENTENCE_ENDINGS.has(char)) {
      boundaryIndex = i + 1;
      break;
    }
  }

  const cutCount = boundaryIndex > 0 ? boundaryIndex : maxChars;
  return sliceByGraphemeClusters(text, cutCount).trimEnd() + TRUNCATION_ELLIPSIS;
}

export function truncateLinesByBudget(
  items: string[],
  maxCount: number,
  maxCharsPerItem: number,
): string[] {
  return items.slice(0, maxCount).map((item) => truncateByCharBudget(item, maxCharsPerItem));
}
