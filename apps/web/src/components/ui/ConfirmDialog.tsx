"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  isMidnight = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isMidnight?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "relative z-10 w-[min(22rem,90vw)] rounded-2xl border p-6 shadow-xl",
              isMidnight
                ? "border-midnight-border bg-midnight-panel"
                : "border-paper-border bg-paper-raised",
            )}
          >
            <h3
              className={cn(
                "mb-2 font-serif text-xl font-semibold",
                isMidnight ? "text-text-inverse" : "text-ink",
              )}
            >
              {title}
            </h3>
            {description && (
              <p
                className={cn(
                  "mb-6 text-sm leading-relaxed",
                  isMidnight ? "text-text-inverse-muted" : "text-text-muted",
                )}
              >
                {description}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className={cn(
                  "min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                  isMidnight
                    ? "text-text-inverse-muted hover:bg-midnight-elevated"
                    : "text-text-body hover:bg-paper-muted",
                )}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-11 rounded-xl bg-terracotta px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-terracotta/90"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
