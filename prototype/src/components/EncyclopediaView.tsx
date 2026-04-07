import React, { useState } from 'react';
import { TAROT_CARDS } from '../constants';
import { TarotCard } from '../types';
import { cn } from '../lib/utils';

const EncyclopediaView: React.FC = () => {
  const [selectedCard, setSelectedCard] = useState<TarotCard>(TAROT_CARDS[0]);

  return (
    <section className="w-full max-w-7xl mx-auto p-8 lg:p-12 flex flex-col lg:flex-row gap-12">
      <div className="w-full lg:w-1/3 space-y-8">
        <header>
          <h1 className="font-serif text-4xl text-secondary mb-2">塔罗百科</h1>
          <p className="font-body text-on-surface-variant text-sm opacity-80 uppercase tracking-widest">Tarot Encyclopedia</p>
        </header>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-outline-variant">
          {TAROT_CARDS.map((card) => (
            <div 
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className={cn(
                "aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-300",
                selectedCard.id === card.id ? "border-secondary-fixed scale-105 shadow-lg shadow-secondary-fixed/20" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img 
                src={card.imageUrl} 
                alt={card.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-3xl p-8 md:p-12 border border-outline-variant/10">
        <div className="flex flex-col md:flex-row gap-12">
          <div className="w-full md:w-1/2">
             <div className="relative aspect-[2/3.5] rounded-2xl overflow-hidden shadow-2xl border border-secondary-fixed/20">
                <img 
                  src={selectedCard.imageUrl} 
                  alt={selectedCard.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60"></div>
             </div>
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <span className="font-label text-xs text-secondary-fixed/60 uppercase tracking-widest">{selectedCard.arcana} • {selectedCard.element}</span>
              <h2 className="font-serif text-5xl text-secondary mt-2">{selectedCard.name}</h2>
              <p className="font-serif italic text-xl text-primary/60">{selectedCard.englishName}</p>
            </div>

            <div className="space-y-4">
              <h4 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Description</h4>
              <p className="text-on-surface-variant leading-relaxed">{selectedCard.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <h4 className="font-label text-xs uppercase tracking-widest text-secondary-fixed">Upright Keywords</h4>
                <ul className="space-y-1">
                  {selectedCard.uprightKeywords.map(kw => (
                    <li key={kw} className="text-sm text-on-surface flex items-center gap-2">
                      <span className="w-1 h-1 bg-secondary-fixed rounded-full"></span>
                      {kw}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-label text-xs uppercase tracking-widest text-primary">Reversed Keywords</h4>
                <ul className="space-y-1">
                  {selectedCard.reversedKeywords.map(kw => (
                    <li key={kw} className="text-sm text-on-surface flex items-center gap-2">
                      <span className="w-1 h-1 bg-primary rounded-full"></span>
                      {kw}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Symbolism</h4>
              <ul className="space-y-2">
                {selectedCard.symbolism.map((sym, i) => (
                  <li key={i} className="text-sm text-on-surface-variant/80 italic border-l border-outline-variant/30 pl-4">{sym}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EncyclopediaView;
