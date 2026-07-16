"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
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

    // Start loading early; generation awaits the same stylesheet promise.
    void ensureShareFontStylesheet().catch(() => {
      // System serif fallback remains available if the stylesheet cannot load.
    });

    // Delay focus slightly to allow the sheet animation to start.
    const timer = setTimeout(() => {
      titleRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    return () => {
      cleanupGeneration();
    };
  }, [cleanupGeneration]);

  const handleModeChange = useCallback(
    (nextMode: ShareMode) => {
      cleanupGeneration();
      setMode(nextMode);
      setGeneration({ status: "idle" });
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
      const confirmed = window.confirm(
        "图片将包含你的问题和解读内容，保存或发送后无法撤回。",
      );
      if (!confirmed) return;
      setHasConfirmedSummary(true);
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
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "图片生成失败，请重试。";
      setGeneration({ status: "error", message });
    }
  }, [cleanupGeneration, hasConfirmedSummary, mode, summaryDisabledReason]);

  const handleShare = useCallback(async () => {
    if (generation.status !== "ready") return;

    try {
      if (canShareFiles()) {
        await shareImageFile(generation.file);
      } else {
        downloadImageBlob(generation.blob, generation.file.name);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      downloadImageBlob(generation.blob, generation.file.name);
    }
  }, [generation]);

  const handleClose = useCallback(() => {
    cleanupGeneration();
    setGeneration({ status: "idle" });
    onOpenChange(false);
    returnFocusRef.current?.focus?.();
  }, [cleanupGeneration, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const model = buildShareCardModel({ reading, drawnCards, mode });
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

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-[101] max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-paper-border bg-paper-raised shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
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

              {/* Preview */}
              {generation.status === "ready" && (
                <div className="mb-5 flex justify-center">
                  <div className="overflow-hidden rounded-xl border border-paper-border shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generation.previewUrl}
                      alt="分享卡预览"
                      className="max-h-[50dvh] w-auto object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {generation.status === "error" && (
                <div className="mb-5 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">
                  {generation.message}
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
                      onClick={() => {
                        if (generation.status === "ready") {
                          downloadImageBlob(generation.blob, generation.file.name);
                        }
                      }}
                      className="btn-secondary min-h-12 w-full"
                    >
                      <LegacyIcon name="download" className="text-[16px]" />
                      保存到相册
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (generation.status === "ready") {
                        downloadImageBlob(generation.blob, generation.file.name);
                      }
                    }}
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
                  取消
                </button>
              </div>
            </div>
          </motion.div>

          {/* Off-screen card stage */}
          <div
            className="pointer-events-none fixed z-0 overflow-hidden"
            style={{
              left: -10000,
              top: 0,
              width: SHARE_CARD_WIDTH,
              height: SHARE_CARD_HEIGHT,
            }}
          >
            <div ref={cardRef}>
              <ReadingShareCard model={model} />
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
