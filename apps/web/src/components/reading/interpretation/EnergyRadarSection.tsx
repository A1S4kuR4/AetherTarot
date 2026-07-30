"use client";

import dynamic from "next/dynamic";
import { CollapsibleSection } from "./CollapsibleSection";
import type { RadarChartValues } from "../RadarChart";

const RadarChart = dynamic(() => import("../RadarChart"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="flex h-[210px] w-[210px] items-center justify-center rounded-full border border-paper-border bg-paper-raised text-center font-sans text-xs leading-relaxed text-text-muted"
    >
      正在整理能量分布…
    </div>
  ),
});

interface EnergyRadarSectionProps {
  values: RadarChartValues;
}

export function EnergyRadarSection({ values }: EnergyRadarSectionProps) {
  return (
    <CollapsibleSection
      id="reading-radar"
      title="牌面呈现了哪些特质"
      defaultOpen={false}
      collapsedHint={
        <p className="text-sm leading-relaxed text-text-muted">
          点击展开查看这组牌里的元素与逆位张力分布。
        </p>
      }
    >
      <div className="mt-2">
        <RadarChart values={values} size={240} layout="stacked" />
      </div>
    </CollapsibleSection>
  );
}
