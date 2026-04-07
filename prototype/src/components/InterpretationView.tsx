import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { TarotCard, Spread } from '../types';
import { cn } from '../lib/utils';

interface InterpretationViewProps {
  question: string;
  spread: Spread;
  drawnCards: { positionId: string; card: TarotCard; isReversed: boolean }[];
  interpretation: string;
  isLoading: boolean;
}

const InterpretationView: React.FC<InterpretationViewProps> = ({ 
  question, 
  spread, 
  drawnCards, 
  interpretation,
  isLoading
}) => {
  return (
    <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
      <div className="flex-1 space-y-20">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-secondary-fixed-dim font-label text-sm tracking-widest uppercase">
            <span className="material-symbols-outlined text-xs">auto_fix_high</span>
            深度见解 Deep Insight
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-secondary leading-tight">灵魂的宏伟图景</h1>
          <p className="text-on-surface-variant font-sans text-lg italic max-w-2xl border-l-2 border-primary/30 pl-6 py-2">
            "在繁星交汇的时刻，寻求真理的人将从沉默的符号中听到宇宙的回响。"
          </p>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="font-serif text-xl text-primary italic animate-pulse">正在连接阿卡西记录...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="markdown-body prose prose-invert max-w-none"
          >
            <ReactMarkdown>{interpretation}</ReactMarkdown>
          </motion.div>
        )}
      </div>

      <aside className="w-full lg:w-80 space-y-8">
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
          <h4 className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-6">Ceremony Progress</h4>
          <div className="space-y-4">
            {['The Inquiry', 'The Ritual', 'The Reveal', 'Deep Insight'].map((step, i) => (
              <div key={step} className={cn("flex items-center gap-3", i < 3 ? "opacity-40" : "")}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  i === 3 ? "bg-secondary-fixed shadow-[0_0_8px_#ffe16d]" : "bg-primary"
                )}></div>
                <span className={cn("text-xs font-label", i === 3 && "text-secondary-fixed font-bold")}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
          <h4 className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-4">The Active Spread</h4>
          <div className="grid grid-cols-2 gap-3">
            {drawnCards.map((d, i) => (
              <div key={i} className="aspect-[2/3] bg-surface-container rounded-lg overflow-hidden border border-outline-variant/20 hover:border-primary/50 transition-colors group">
                <img 
                  src={d.card.imageUrl} 
                  alt={d.card.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-l border-secondary-fixed/30 bg-secondary-fixed/5 rounded-r-xl">
          <p className="font-serif italic text-sm text-secondary-fixed/80 leading-relaxed">
            “真理并非被创造的，它只是被揭晓了。你的职业道路已经是你灵魂的一部分。”
          </p>
        </div>
      </aside>
    </main>
  );
};

export default InterpretationView;
