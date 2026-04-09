"use client";

import { useReading } from "@/context/ReadingContext";
import HomeView from "@/components/home/HomeView";
import JourneyView from "@/components/home/JourneyView";

export default function HomePage() {
  const { history, isHydrated } = useReading();

  if (!isHydrated) return null;

  if (history.length > 0) {
    return <JourneyView />;
  }

  return <HomeView />;
}
