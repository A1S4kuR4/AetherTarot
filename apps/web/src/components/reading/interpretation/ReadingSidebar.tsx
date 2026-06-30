"use client";

import { cn } from "@/lib/utils";
import type { DrawSource, Spread } from "@aethertarot/shared-types";

interface ReadingSidebarProps {
  spread: Spread;
  drawSource: DrawSource;
}

export function ReadingSidebar({ spread, drawSource }: ReadingSidebarProps) {
  const steps = [
    "提问",
    drawSource === "offline_manual" ? "录入" : "仪式",
    "揭示",
    "解读",
  ];

  return (
    <>
      <div className="reading-card">
        <h4 className="mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          解读流程
        </h4>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step}
              className={cn("flex items-center gap-2.5", index < 3 && "opacity-40")}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  index === 3 ? "bg-terracotta" : "bg-paper-border",
                )}
              />
              <span
                className={cn(
                  "font-sans text-xs",
                  index === 3 && "font-medium text-terracotta",
                )}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="reading-card">
        <h4 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          使用牌阵：{spread.name}
        </h4>
        <p className="mt-2 font-serif text-sm italic leading-relaxed text-text-muted">
          {spread.description}
        </p>
      </div>

      <div className="rounded-xl border-l-2 border-terracotta/25 bg-terracotta/5 p-5">
        <p className="font-serif text-sm italic leading-relaxed text-text-muted">
          真理并不是被强行规定的结论，而是从你的处境中慢慢浮现的方向感。
        </p>
      </div>
    </>
  );
}
