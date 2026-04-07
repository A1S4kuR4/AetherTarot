import React from 'react';
import { motion } from 'motion/react';
import { Spread, TarotCard } from '../types';
import { cn } from '../lib/utils';

interface RevealViewProps {
  spread: Spread;
  drawnCards: { positionId: string; card: TarotCard; isReversed: boolean }[];
  onInterpret: () => void;
}

const RevealView: React.FC<RevealViewProps> = ({ spread, drawnCards, onInterpret }) => {
  return (
    <section className="pt-28 pb-12 px-6 max-w-7xl mx-auto w-full">
      <div className="mb-12 flex justify-center items-center gap-4">
        <div className="h-[1px] w-12 bg-outline-variant/30"></div>
        <div className="flex items-center gap-2">
          <span className="font-label text-xs text-on-surface-variant/50">Step 02</span>
          <h1 className="font-serif text-3xl text-secondary">牌阵解读 <span className="text-primary/60 italic font-normal text-xl ml-2">The Spread</span></h1>
        </div>
        <div className="h-[1px] w-12 bg-outline-variant/30"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-8 flex flex-col items-center justify-center min-h-[600px] bg-surface-container-low/30 rounded-[2rem] p-8 border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
            <svg className="text-primary fill-current" height="500" viewBox="0 0 100 100" width="500">
              <path d="M50 5 L95 85 L5 85 Z" fill="none" stroke="currentColor" stroke-width="0.5"></path>
              <circle cx="50" cy="50" fill="none" r="40" stroke="currentColor" stroke-width="0.2"></circle>
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-4xl relative z-10">
            {spread.positions.map((pos, idx) => {
              const drawn = drawnCards.find(d => d.positionId === pos.id);
              if (!drawn) return null;

              return (
                <motion.div 
                  key={pos.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.3 }}
                  className={cn(
                    "flex flex-col items-center group",
                    idx === 1 && "md:-mt-16" // Present card slightly higher for triangle
                  )}
                >
                  <div className="mb-4">
                    <span className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary-fixed/40">{pos.name}</span>
                  </div>
                  <div className={cn(
                    "relative w-full aspect-[2/3.5] rounded-xl overflow-hidden shadow-2xl border bg-surface-container transition-transform duration-700 hover:scale-[1.03]",
                    idx === 1 ? "border-secondary-fixed/30" : "border-primary/20"
                  )}>
                    <img 
                      src={drawn.card.imageUrl} 
                      alt={drawn.card.name}
                      className={cn("w-full h-full object-cover", drawn.isReversed && "rotate-180")}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60"></div>
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="font-serif text-xl text-secondary-fixed">{drawn.card.name} <span className="italic text-sm block font-normal text-on-surface-variant">{drawn.card.englishName}</span></h3>
                    <div className="flex gap-2 mt-2 justify-center">
                      {drawn.card.uprightKeywords.slice(0, 2).map(kw => (
                        <span key={kw} className="px-2 py-0.5 rounded-full bg-surface-variant text-[10px] text-on-surface-variant uppercase tracking-tighter">{kw}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <button 
            onClick={onInterpret}
            className="mt-16 group flex items-center gap-3 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label px-8 py-4 rounded-full shadow-lg hover:shadow-primary/20 transition-all duration-500 hover:scale-105 active:scale-95"
          >
            <span className="tracking-widest uppercase text-xs font-bold">开始深入解读</span>
            <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
          </button>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 rounded-[1.5rem] bg-surface-container-high border-t border-secondary-fixed/20 shadow-inner">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-secondary-fixed">auto_awesome</span>
              <h2 className="font-serif text-xl text-secondary">牌阵解析 <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant/50 block">Position Meanings</span></h2>
            </div>
            <div className="space-y-8">
              {spread.positions.map((pos, idx) => (
                <div key={pos.id} className="relative pl-6 border-l border-outline-variant/30">
                  <div className={cn(
                    "absolute -left-[5px] top-0 w-2 h-2 rounded-full",
                    idx === 1 ? "bg-secondary-fixed/40" : "bg-primary/40"
                  )}></div>
                  <h4 className={cn(
                    "font-label text-xs uppercase tracking-widest mb-1",
                    idx === 1 ? "text-secondary-fixed" : "text-primary"
                  )}>Position {idx + 1}: {pos.name}</h4>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {pos.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/10">
            <p className="font-serif italic text-sm text-on-surface-variant/80 text-center leading-relaxed">
              "在星辰的指引下，所有的偶然都是必然的投影。"
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RevealView;
