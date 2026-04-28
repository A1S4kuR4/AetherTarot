"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface PaginationDotsProps {
  total: number;
  active: number;
  onChange: (index: number) => void;
}

export default function PaginationDots({ total, active, onChange }: PaginationDotsProps) {
  return (
    <div className="fixed right-8 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-4 md:flex">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-current={active === i ? "true" : undefined}
          className="group relative flex items-center justify-center p-2"
          aria-label={`跳转到第 ${i + 1} 节`}
        >
          <motion.div
            animate={{
              scale: active === i ? 1.5 : 1,
              backgroundColor: active === i ? "var(--color-terracotta)" : "var(--color-paper-border)",
            }}
            className={cn(
              "h-2 w-2 rounded-full transition-colors duration-300",
              active === i ? "shadow-[0_0_8px_rgba(201,100,66,0.3)]" : "group-hover:bg-text-muted/40"
            )}
          />
          
          {/* Label tooltip on hover */}
          <span className="absolute right-8 origin-right scale-0 rounded-md bg-paper-raised px-2 py-1 text-[10px] font-medium text-ink shadow-sm transition-all group-hover:scale-100 border border-paper-border">
            {[`绪论`, `象征`, `心智`, `抉择`][i]}
          </span>
        </button>
      ))}
    </div>
  );
}
