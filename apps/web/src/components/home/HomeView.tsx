"use client";

import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";
import { m } from "motion/react";
import NextLink from "next/link";

import IntroSection from "./sections/IntroSection";
import KnowledgeSection from "./sections/KnowledgeSection";
import MindsetSection from "./sections/MindsetSection";
import FinalGateSection from "./sections/FinalGateSection";
import PaginationDots from "./PaginationDots";
import LegacyIcon from "@/components/ui/LegacyIcon";

export default function HomeView() {
  const [activeSection, setActiveSection] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);

  const getSections = useCallback(() => {
    return containerRef.current?.querySelectorAll<HTMLElement>(
      ":scope > .scroll-snap-section",
    );
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
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
      { 
        threshold: 0.5,
        rootMargin: "-64px 0px 0px 0px",
      },
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

      if (window.matchMedia("(min-width: 1024px) and (min-height: 860px)").matches) {
        const targetTop = sections[index].offsetTop;
        container.scrollTo({
          top: targetTop,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      } else {
        const rect = sections[index].getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        const topBarHeight = 64;
        window.scrollTo({
          top: absoluteTop - topBarHeight,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }

      setActiveSection(index);
    },
    [getSections, prefersReducedMotion],
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
    }, prefersReducedMotion ? 100 : 700);
  };

  return (
    <div className="relative bg-paper viewport-workspace">
      {/* Pagination Dots */}
      <PaginationDots 
        total={4} 
        active={activeSection} 
        onChange={scrollToSection} 
      />

      {activeSection < 3 ? (
        <m.div
          data-testid="home-scroll-cue"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 bottom-5 z-40 mx-auto w-max md:hidden"
        >
          <NextLink
            href="/new"
            className="flex min-h-12 items-center gap-2 rounded-full border border-terracotta/30 bg-paper-raised px-4 py-2 text-xs font-medium text-terracotta shadow-[0_10px_28px_rgba(24,23,19,0.14)]"
          >
            <span>进入仪式场域</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-paper">
              <LegacyIcon name="arrow_forward" className="text-[17px]" />
            </span>
          </NextLink>
        </m.div>
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
    </div>
  );
}
