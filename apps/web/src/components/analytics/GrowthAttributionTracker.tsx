"use client";

import { useEffect } from "react";
import { captureGrowthVisit } from "@/lib/growth-attribution";

export function GrowthAttributionTracker() {
  useEffect(() => {
    captureGrowthVisit();
  }, []);

  return null;
}
