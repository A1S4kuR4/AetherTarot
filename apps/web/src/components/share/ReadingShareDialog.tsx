"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { DrawnCard, StructuredReading } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";
import LegacyIcon from "@/components/ui/LegacyIcon";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_MODE_DESCRIPTIONS,
  SHARE_MODE_LABELS,
  SHARE_SAFETY_NOTE_MAX_LENGTH,
  type ShareMode,
} from "./constants";
import { ReadingShareCard } from "./ReadingShareCard";
import { trackShareEvent } from "./share-analytics";
import { buildShareCardModel } from "./share-model";
import {
  blobToFile,
  canShareFiles,
  createObjectUrl,
  downloadImageBlob,
  ensureShareFontStylesheet,
  generateShareImage,
  revokeObjectUrl,
  shareImageFile,
  type GenerateImageOptions,
} from "./share-image";

interface ReadingShareDialogProps {
  reading: StructuredReading;
  drawnCards: DrawnCard[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "ready"; blob: Blob; previewUrl: string; file: File }
  | { status: "error"; message: string };

// Live preview scale: the card stays at full size for image generation;
// only its wrapper is scaled down for display.
const PREVIEW_SCALE = 340 / SHARE_CARD_HEIGHT;
const PREVIEW_WIDTH = SHARE_CARD_WIDTH * PREVIEW_SCALE;
const PREVIEW_HEIGHT = SHARE_CARD_HEIGHT * PREVIEW_SCALE;

function getSummaryDisabledReason(reading: StructuredReading): string | null {
  if (reading.sober_check) {
    return "本次解读包含现实决策提醒，暂不支持分享完整解读。";
  }

  if (
    reading.safety_note
    && reading.safety_note.length > SHARE_SAFETY_NOTE_MAX_LENGTH
  ) {
    return "安全说明较长，为避免裁切，暂不支持分享摘要卡。可使用牌阵卡。";
  }

  return null;
}

export function ReadingShareDialog({
  reading,
  drawnCards,
  open,
  onOpenChange,
}: ReadingShareDialogProps) {
  const id = useId();
  const [mode, setMode] = useState<ShareMode>("minimal");
  const [hasConfirmedSummary, setHasConfirmedSummary] = useState(false);
  const [generation, setGeneration] = useState<GenerationState>({ status: "idle" });
  const [completedAction, setCompletedAction] = useState<"shared" | "downloaded" | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const summaryDisabledReason = getSummaryDisabledReason(reading);

  const cleanupGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    trackShareEvent("share_dialog_open", { cardCount: drawnCards.length });

    // Start loading early; generation awaits the same stylesheet promise.
    void ensureShareFontStylesheet().catch(() => {
      // System serif fallback remains available if the stylesheet cannot load.
    });

    return () => {
      const returnTarget = returnFocusRef.current;
      window.setTimeout(() => {
        if (returnTarget?.isConnected) {
          returnTarget.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [open, drawnCards.length]);

  useLayoutEffect(() => {
    if (open) {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    return () => {
      cleanupGeneration();
    };
  }, [cleanupGeneration]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: ShareMode) => {
      cleanupGeneration();
      setMode(nextMode);
      setGeneration({ status: "idle" });
      setCompletedAction(null);
      trackShareEvent("share_mode_select", { mode: nextMode });
    },
    [cleanupGeneration],
  );

  const handleGenerate = useCallback(async () => {
    if (!cardRef.current) return;

    if (mode === "summary" && summaryDisabledReason) {
      setGeneration({ status: "error", message: summaryDisabledReason });
      return;
    }

    if (mode === "summary" && !hasConfirmedSummary) {
      // The generate button stays disabled until the inline notice is checked.
      return;
    }

    cleanupGeneration();

    const controller = new AbortController();
    abortRef.current = controller;

    setGeneration({ status: "generating" });

    const options: GenerateImageOptions = {
      signal: controller.signal,
      scale: 2,
      backgroundColor: "#F5F2E8",
    };

    try {
      const blob = await generateShareImage(cardRef.current, options);

      if (controller.signal.aborted) {
        return;
      }

      const previewUrl = createObjectUrl(blob);
      previewUrlRef.current = previewUrl;
      const file = blobToFile(blob, `aether-tarot-${mode}-share.png`);
      setGeneration({ status: "ready", blob, previewUrl, file });
      trackShareEvent("share_image_generated", {
        mode,
        cardCount: drawnCards.length,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "图片生成失败，请重试。";
      setGeneration({ status: "error", message });
      trackShareEvent("share_image_failed", { mode, error: message });
    }
  }, [cleanupGeneration, drawnCards.length, hasConfirmedSummary, mode, summaryDisabledReason]);

  const handleShare = useCallback(async () => {
    if (generation.status !== "ready") return;

    try {
      const shared = await shareImageFile(generation.file);
      if (shared) {
        setCompletedAction("shared");
        trackShareEvent("share_completed", { mode });
      }
    } catch {
      // System share failed (e.g. no compatible target); fall back to download.
      downloadImageBlob(generation.blob, generation.file.name);
      setCompletedAction("downloaded");
      trackShareEvent("share_downloaded", { mode });
    }
  }, [generation, mode]);

  const handleDownload = useCallback(() => {
    if (generation.status !== "ready") return;

    downloadImageBlob(generation.blob, generation.file.name);
    setCompletedAction("downloaded");
    trackShareEvent("share_downloaded", { mode });
  }, [generation, mode]);

  const handleClose = useCallback(() => {
    cleanupGeneration();
    setGeneration({ status: "idle" });
    setCompletedAction(null);
    onOpenChange(false);
  }, [cleanupGeneration, onOpenChange]);

  const handleDialogKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleClose();
      return;
    }

    // Bind the trap to the dialog itself so it is active as soon as the
    // interactive node mounts, without waiting for an effect listener.
    if (event.key === "Tab" && sheetRef.current) {
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (
        !event.shiftKey
        && (activeIndex === -1 || activeIndex === focusable.length - 1)
      ) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
  }, [handleClose]);

  const model = useMemo(
    () => buildShareCardModel({ reading, drawnCards, mode }),
    [reading, drawnCards, mode],
  );
  const titleId = `share-title-${id}`;
  const descId = `share-desc-${id}`;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Sheet on mobile, centered modal on desktop.
              Centering uses inset-0 + m-auto (no CSS transform) so it never
              conflicts with the motion transform animations. */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            ref={sheetRef}
            className={cn(
              "fixed z-[101] overflow-y-auto border-paper-border bg-paper-raised shadow-2xl",
              "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl border-t",
              "sm:inset-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-md sm:max-h-[85vh] sm:rounded-3xl sm:border",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onKeyDown={handleDialogKeyDown}
          >
            <div className="mx-auto w-full max-w-md px-5 pb-8 pt-5">
              {/* Handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-paper-border" />

              <h2
                ref={titleRef}
                id={titleId}
                tabIndex={-1}
                className="mb-1 font-serif text-xl font-semibold text-ink outline-none"
              >
                分享这张解读
              </h2>
              <p id={descId} className="mb-5 text-sm text-text-muted">
                选择分享样式，生成后保存或发送图片。
              </p>

              {/* Mode selection */}
              {generation.status !== "ready" && (
                <div className="mb-5 space-y-3">
                  {(["minimal", "summary"] as ShareMode[]).map((m) => {
                    const disabled =
                      Boolean(summaryDisabledReason) && m === "summary";
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleModeChange(m)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition",
                          mode === m
                            ? "border-terracotta/40 bg-terracotta/5"
                            : "border-paper-border bg-paper hover:border-terracotta/20",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-ink">
                            {SHARE_MODE_LABELS[m]}
                          </span>
                          {mode === m && (
                            <LegacyIcon
                              name="check_circle"
                              className="text-terracotta"
                            />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          {disabled
                            ? summaryDisabledReason
                            : SHARE_MODE_DESCRIPTIONS[m]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inline privacy confirmation for summary mode (replaces a
                  blocking window.confirm). */}
              {mode === "summary"
                && !summaryDisabledReason
                && generation.status !== "ready" && (
                <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-paper-border bg-paper px-3.5 py-3 text-xs leading-relaxed text-text-muted">
                  <input
                    type="checkbox"
                    checked={hasConfirmedSummary}
                    onChange={(event) => setHasConfirmedSummary(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-terracotta"
                  />
                  我明白图片将包含我的问题和解读内容，保存或发送后无法撤回。
                </label>
              )}

              {/* Live preview — the card doubles as the generation source,
                  so what the user sees here is what gets exported. It stays
                  mounted after generation (moved off-screen) because layout
                  assertions and the generated image both rely on this DOM. */}
              <div
                className={
                  generation.status === "ready"
                    ? "pointer-events-none fixed left-[-10000px] top-0 overflow-hidden"
                    : "mb-5 flex justify-center"
                }
              >
                <div
                  className="overflow-hidden rounded-xl border border-paper-border shadow-md"
                  style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
                >
                  <div
                    style={{
                      width: SHARE_CARD_WIDTH,
                      height: SHARE_CARD_HEIGHT,
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <div ref={cardRef}>
                      <ReadingShareCard model={model} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Generated image preview — click to inspect the full-size
                  image (e.g. text truncation) in a new tab. */}
              {generation.status === "ready" && (
                <div className="mb-5 flex justify-center">
                  <a
                    href={generation.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="点击查看原图"
                    className="cursor-zoom-in overflow-hidden rounded-xl border border-paper-border shadow-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generation.previewUrl}
                      alt="分享卡预览"
                      className="max-h-[50dvh] w-auto object-contain"
                    />
                  </a>
                </div>
              )}

              {/* Error */}
              {generation.status === "error" && (
                <div className="mb-5 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">
                  {generation.message}
                </div>
              )}

              {/* Success feedback */}
              {completedAction && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">
                  <LegacyIcon name="check_circle" className="text-[16px]" />
                  {completedAction === "shared" ? "图片已分享。" : "图片已保存。"}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                {generation.status !== "ready" ? (
                  <button
                    type="button"
                    disabled={
                      generation.status === "generating"
                      || (mode === "summary" && Boolean(summaryDisabledReason))
                      || (mode === "summary" && !hasConfirmedSummary)
                    }
                    onClick={handleGenerate}
                    className="btn-primary min-h-12 w-full"
                  >
                    {generation.status === "generating" ? (
                      <>
                        <LegacyIcon
                          name="progress_activity"
                          className="animate-spin text-[16px]"
                        />
                        生成图片中…
                      </>
                    ) : (
                      "生成图片"
                    )}
                  </button>
                ) : canShareFiles() ? (
                  <>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="btn-primary min-h-12 w-full"
                    >
                      <LegacyIcon name="share" className="text-[16px]" />
                      分享图片
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="btn-secondary min-h-12 w-full"
                    >
                      <LegacyIcon name="download" className="text-[16px]" />
                      保存到相册
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="btn-primary min-h-12 w-full"
                  >
                    <LegacyIcon name="download" className="text-[16px]" />
                    保存图片
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-ghost min-h-12 w-full"
                >
                  {generation.status === "ready" ? "完成" : "取消"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
