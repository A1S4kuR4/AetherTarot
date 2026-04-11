"use client";

import { motion } from "motion/react";
import IntroSection from "./sections/IntroSection";
import KnowledgeSection from "./sections/KnowledgeSection";
import MindsetSection from "./sections/MindsetSection";
import { useReading } from "@/context/ReadingContext";
import { Link } from "lucide-react"; // Actually let's use a standard link or router
import NextLink from "next/link";
import RitualInitializer from "./RitualInitializer";

export default function HomeView() {
  const { history } = useReading();
  const hasHistory = history.length > 0;

  return (
    <main className="flex min-h-screen flex-col bg-paper relative">
      {/* Scroll indicator - subtle line at the left */}
      <div className="fixed left-4 top-1/2 hidden h-32 w-px -translate-y-1/2 bg-paper-border md:block">
        <motion.div 
          className="w-full bg-terracotta origin-top"
          style={{ height: '30%' }} 
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden">
        {/* Section 1: Intro */}
        <IntroSection />

        {/* Section 2: Knowledge */}
        <KnowledgeSection />

        {/* Section 3: Mindset */}
        <MindsetSection />

        {/* Section 4: Ritual Entry / Welcome Back */}
        <section id="ask" className="flex min-h-[90vh] flex-col items-center justify-center bg-paper py-20 px-6">
          {hasHistory ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full max-w-2xl text-center space-y-10"
            >
              <div className="space-y-4">
                <h2 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
                  欢迎归来
                </h2>
                <p className="font-sans text-text-muted leading-relaxed">
                  你的意识之流已在此汇聚。是选择继续追溯过往的线索，<br />还是在此开启一段全新的探索？
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <NextLink 
                  href="/journey"
                  className="btn-primary flex items-center justify-center gap-2 px-8 py-4"
                >
                  <span className="material-symbols-outlined text-sm">auto_stories</span>
                  回溯我的旅程
                </NextLink>
                <button 
                  onClick={() => {
                    document.getElementById('new-reading-anchor')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-secondary px-8 py-4"
                >
                  开始新的抽牌
                </button>
              </div>

              {/* Collapsed Ritual Initializer for returning users if they want to start immediately */}
              <div id="new-reading-anchor" className="pt-24 opacity-20 hover:opacity-100 transition-opacity duration-500">
                <div className="mb-12 h-px w-full bg-gradient-to-r from-transparent via-paper-border to-transparent" />
                <h3 className="mb-12 font-serif text-2xl text-text-muted">开启新的仪式</h3>
                <RitualInitializer />
              </div>
            </motion.div>
          ) : (
            <>
              <motion.header 
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-12 text-center"
              >
                <h2 className="font-serif text-3xl font-semibold text-ink md:text-4xl">
                  现在，收束你的意图
                </h2>
                <p className="mt-4 font-sans text-sm text-text-muted">
                  准备好后，向内心发起询问
                </p>
              </motion.header>
              <RitualInitializer />
            </>
          )}
        </section>
      </div>

      {/* Subtle bottom gradient to merge with footer or next section */}
      <div className="h-24 bg-gradient-to-t from-paper-raised to-transparent" />
    </main>
  );
}