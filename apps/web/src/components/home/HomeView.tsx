"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import NextLink from "next/link";
import { useReading } from "@/context/ReadingContext";

import IntroSection from "./sections/IntroSection";
import KnowledgeSection from "./sections/KnowledgeSection";
import MindsetSection from "./sections/MindsetSection";
import PaginationDots from "./PaginationDots";

export default function HomeView() {
  const { history } = useReading();
  const hasHistory = history.length > 0;
  
  const [activeSection, setActiveSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer to detect current section
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
      { threshold: 0.6 } // High threshold to ensure snap is nearly complete
    );

    const sections = containerRef.current?.querySelectorAll(":scope > .scroll-snap-section");
    sections?.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (index: number) => {
    const sections = containerRef.current?.querySelectorAll(":scope > .scroll-snap-section");
    if (sections?.[index]) {
      sections[index].scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="relative h-screen bg-paper overflow-hidden">
      {/* Pagination Dots */}
      <PaginationDots 
        total={4} 
        active={activeSection} 
        onChange={scrollToSection} 
      />

      {/* Snap Scroll Container */}
      <div 
        ref={containerRef}
        className="scroll-snap-container hide-scrollbar"
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
          <section className="flex w-full max-w-5xl flex-col items-center justify-center px-6 text-center">
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-16 space-y-4"
            >
              <h2 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
                通往深处
              </h2>
              <p className="mx-auto max-w-lg text-base text-text-muted">
                在这里，你的意志将化为指引。你选择回顾过往的影子，还是开启一段未知的仪式？
              </p>
            </motion.header>

            <div className="grid w-full gap-8 md:grid-cols-2">
              {/* Path A: Journey */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="group relative"
              >
                <NextLink href="/journey" className="block text-left">
                  <div className="overflow-hidden rounded-[32px] border border-paper-border bg-paper-raised p-2 transition-all duration-500 hover:border-terracotta/30 hover:shadow-xl">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-paper-muted">
                      {/* Symbolic representation of history */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700 scale-110 group-hover:scale-100">
                        <span className="material-symbols-outlined text-8xl text-text-placeholder">receipt_long</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/20 to-transparent p-6">
                        <span className="chip-warm text-[10px] uppercase tracking-widest">
                          Memory Archive
                        </span>
                      </div>
                    </div>
                    <div className="px-6 py-6">
                      <h3 className="mb-2 font-serif text-2xl text-ink">回溯过往旅程</h3>
                      <p className="text-sm leading-relaxed text-text-muted">
                        在这面镜子前，你曾经的提问与线索依然闪烁，等待着再次被反思。
                      </p>
                    </div>
                  </div>
                </NextLink>
              </motion.div>

              {/* Path B: New Ritual */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="group relative"
              >
                <NextLink href="/new" className="block text-left">
                  <div className="overflow-hidden rounded-[32px] border border-ink/5 bg-night p-2 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-midnight-panel">
                      {/* Symbolic representation of new ritual */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-80 transition-all duration-700 scale-110 group-hover:scale-100">
                        <span className="material-symbols-outlined text-8xl text-indigo/60">auto_awesome</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                        <span className="rounded-full border border-indigo/20 bg-indigo/10 px-3 py-1 text-[10px] uppercase tracking-widest text-indigo-400">
                          New Ritual
                        </span>
                      </div>
                    </div>
                    <div className="px-6 py-6">
                      <h3 className="mb-2 font-serif text-2xl text-text-inverse">开启崭新仪式</h3>
                      <p className="text-sm leading-relaxed text-text-inverse-muted">
                        在这片虚空中，你可以收束意念，让 78 张牌重新排列出当下的共鸣。
                      </p>
                    </div>
                  </div>
                </NextLink>
              </motion.div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}