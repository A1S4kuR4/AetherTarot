import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Spread, TarotCard } from '../types';
import { TAROT_CARDS } from '../constants';
import { cn } from '../lib/utils';

interface RitualViewProps {
  spread: Spread;
  onComplete: (cards: { positionId: string; card: TarotCard; isReversed: boolean }[]) => void;
}

const RitualView: React.FC<RitualViewProps> = ({ spread, onComplete }) => {
  const [drawnCards, setDrawnCards] = useState<{ positionId: string; card: TarotCard; isReversed: boolean }[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [deck, setDeck] = useState<TarotCard[]>([]);

  useEffect(() => {
    setDeck([...TAROT_CARDS].sort(() => Math.random() - 0.5));
  }, []);

  const handleShuffle = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setDeck([...deck].sort(() => Math.random() - 0.5));
      setIsShuffling(false);
    }, 1000);
  };

  const handleDraw = () => {
    if (drawnCards.length >= spread.positions.length) return;

    const nextPosition = spread.positions[drawnCards.length];
    const randomIndex = Math.floor(Math.random() * deck.length);
    const card = deck[randomIndex];
    const isReversed = Math.random() > 0.8;

    const newDrawnCards = [...drawnCards, { positionId: nextPosition.id, card, isReversed }];
    setDrawnCards(newDrawnCards);

    if (newDrawnCards.length === spread.positions.length) {
      setTimeout(() => onComplete(newDrawnCards), 1500);
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center py-12 px-6">
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center text-center mb-12">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-secondary-fixed shadow-[0_0_8px_#ffe16d]"></span>
          <span className="font-label text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">Active Ritual</span>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl text-secondary mb-4">洗牌与抽牌 (The Ritual)</h1>
        <p className="font-body text-on-surface-variant max-w-xl text-lg opacity-80 italic">
          静下心来，专注于你的问题，感受卡牌中的能量。
        </p>
      </div>

      <div className="relative z-10 w-full flex-grow flex flex-col items-center justify-start pb-32">
        {/* Spread Area */}
        <div className="mt-8 mb-16 flex flex-wrap justify-center gap-8 md:gap-16 items-end">
          {spread.positions.map((pos, idx) => {
            const drawn = drawnCards.find(d => d.positionId === pos.id);
            return (
              <div key={pos.id} className="flex flex-col items-center gap-4">
                <div className={cn(
                  "w-24 h-40 md:w-32 md:h-52 rounded-xl bg-surface-container-lowest border flex items-center justify-center relative overflow-hidden group transition-all duration-500",
                  drawn ? "border-primary shadow-[0_0_20px_rgba(203,190,255,0.2)]" : "border-dashed border-outline-variant/40"
                )}>
                  {drawn ? (
                    <img 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJ5qfZ_tC9eu7tMl4jNchwH7eG-LhduNDIomhnaD2-3eHNq38F47elEnvrTAzM_j6Ht16KTaAEpTyjpyBCvTCH9P1JRPZuYQzgF9zk9R4ry6WfC_JO8MPb_dRBt5DX4dHLHUWGKtwcV-alZSxcUDo-64V9oD9o0T1JdY5N1YWwHxyD6yiOzVJOG2ek_80OOBRtHaRQsGex9z9jo5xgc2U_BaDdh99j2cO0XyK1NdeLLwfuY2AYAC2PLDEiWuxdQshvc3qnTGg-F6o7" 
                      alt="Tarot Back"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="font-label text-[10px] text-outline tracking-tighter uppercase opacity-40">
                      {pos.name}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "font-label text-[10px] tracking-[0.2em] uppercase",
                  drawn ? "text-secondary-fixed" : "text-on-surface-variant/60"
                )}>
                  {pos.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Deck Area */}
        <div className="relative w-full max-w-5xl h-[300px] flex items-center justify-center">
          <div className="absolute top-[-60px] z-50 flex gap-4">
            <button 
              onClick={handleShuffle}
              disabled={isShuffling || drawnCards.length === spread.positions.length}
              className="group relative px-10 py-4 bg-gradient-to-r from-primary to-primary-container rounded-full text-on-primary font-label font-bold tracking-[0.15em] uppercase text-sm flex items-center gap-3 shadow-lg hover:scale-105 transition-all duration-500 disabled:opacity-50"
            >
              <span className={cn("material-symbols-outlined", isShuffling && "animate-spin")}>refresh</span>
              <span>Shuffle Deck</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center w-full h-full">
            {Array.from({ length: 15 }).map((_, i) => (
              <motion.div 
                key={i}
                animate={isShuffling ? {
                  x: [0, (i - 7) * 20, 0],
                  rotate: [i * 5 - 35, 0, i * 5 - 35],
                } : {}}
                transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0 }}
                className="absolute w-32 h-52 md:w-40 md:h-64 rounded-xl border border-outline-variant/30 shadow-2xl cursor-pointer bg-surface-container p-1.5"
                style={{ 
                  transform: `rotate(${(i - 7) * 5}deg) translateX(${(i - 7) * 30}px)`,
                  zIndex: 10 + i
                }}
                onClick={handleDraw}
              >
                <div className="w-full h-full rounded-lg border border-primary/20 bg-surface-container-lowest overflow-hidden">
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJ5qfZ_tC9eu7tMl4jNchwH7eG-LhduNDIomhnaD2-3eHNq38F47elEnvrTAzM_j6Ht16KTaAEpTyjpyBCvTCH9P1JRPZuYQzgF9zk9R4ry6WfC_JO8MPb_dRBt5DX4dHLHUWGKtwcV-alZSxcUDo-64V9oD9o0T1JdY5N1YWwHxyD6yiOzVJOG2ek_80OOBRtHaRQsGex9z9jo5xgc2U_BaDdh99j2cO0XyK1NdeLLwfuY2AYAC2PLDEiWuxdQshvc3qnTGg-F6o7" 
                    alt="Tarot Back"
                    className="w-full h-full object-cover opacity-80"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status Card */}
        <div className="mt-24 w-full max-w-lg mx-auto">
          <div className="glass-panel p-8 rounded-xl border-t-2 border-secondary-fixed/40 text-center">
            <h3 className="font-serif text-xl text-secondary mb-2">Aether Insight</h3>
            <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-6 italic">
              "灵性已与你的提问对齐。你已选择 {drawnCards.length} / {spread.positions.length} 张牌。{spread.name}将揭示你的过去、现状与未来的宇宙路径。"
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RitualView;
