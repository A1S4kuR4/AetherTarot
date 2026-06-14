"use client";

import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";
import { m } from "motion/react";
import dynamic from "next/dynamic";

import IntroSection from "./sections/IntroSection";

const KnowledgeSection = dynamic(() => import("./sections/KnowledgeSection"));
const MindsetSection = dynamic(() => import("./sections/MindsetSection"));
const FinalGateSection = dynamic(() => import("./sections/FinalGateSection"));
import PaginationDots from "./PaginationDots";
import LegacyIcon from "@/components/ui/LegacyIcon";

export default function HomeView() {
  const [activeSection, setActiveSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);

  const getSections = useCallback(() => {
    return containerRef.current?.querySelectorAll<HTMLElement>(
      ":scope > .scroll-snap-section",
    );
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setActiveSection(index);
          }
        });
      },
      { threshold: 0.6 },
    );

    const sections = getSections();
    sections?.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [getSections]);

  const scrollToSection = useCallback(
    (index: number) => {
      const container = containerRef.current;
      const sections = getSections();

      if (!container || !sections?.[index]) {
        return;
      }

      const targetTop = sections[index].offsetTop;

      if (window.matchMedia("(min-width: 1024px) and (min-height: 860px)").matches) {
        container.scrollTo({
          top: targetTop,
          behavior: "smooth",
        });
      } else {
        window.scrollTo({
          top: container.offsetTop + targetTop,
          behavior: "smooth",
        });
      }

      setActiveSection(index);
    },
    [getSections],
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 8) {
      return;
    }

    event.preventDefault();

    if (wheelLockRef.current) {
      return;
    }

    const sections = getSections();
    const total = sections?.length ?? 0;
    const nextIndex = Math.max(
      0,
      Math.min(total - 1, activeSection + (event.deltaY > 0 ? 1 : -1)),
    );

    if (nextIndex === activeSection) {
      return;
    }

    wheelLockRef.current = true;
    scrollToSection(nextIndex);
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 700);
  };

  return (
    <main className="relative min-h-[calc(100dvh-4rem)] bg-paper lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      {/* Pagination Dots */}
      <PaginationDots 
        total={4} 
        active={activeSection} 
        onChange={scrollToSection} 
      />

      {activeSection < 3 ? (
        <m.button
          type="button"
          data-testid="home-scroll-cue"
          aria-label="继续下探"
          onClick={() => scrollToSection(activeSection + 1)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 bottom-5 z-40 mx-auto flex min-h-12 w-max items-center gap-2 rounded-full border border-terracotta/25 bg-paper-raised/95 px-4 py-2 text-xs font-medium text-terracotta shadow-[0_10px_28px_rgba(24,23,19,0.14)] backdrop-blur md:hidden"
        >
          <span>继续下探</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-paper shadow-sm">
            <LegacyIcon name="keyboard_arrow_down" className="animate-float-slow text-[18px]" />
          </span>
        </m.button>
      ) : null}

      {/* Snap Scroll Container */}
      <div 
        ref={containerRef}
        data-testid="home-snap-container"
        className="scroll-snap-container hide-scrollbar"
        onWheel={handleWheel}
      >
        {/* Section 0: Intro */}
        <div data-index="0" className="scroll-snap-section">
          <IntroSection />
        </div>

        {/* Section 1: Knowledge */}
        <div data-index="1" className="scroll-snap-section">
          <KnowledgeSection />
        </div>

        {/* Section 2: Mindset */}
        <div data-index="2" className="scroll-snap-section">
          <MindsetSection />
        </div>

        {/* Section 3: The Fork / Final Gate */}
        <div data-index="3" className="scroll-snap-section">
          <FinalGateSection />
        </div>
      </div>
    </main>
  );
}
