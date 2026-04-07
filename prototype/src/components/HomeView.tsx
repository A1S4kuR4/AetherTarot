import React from 'react';
import { motion } from 'motion/react';
import { SPREADS } from '../constants';
import { Spread } from '../types';
import { cn } from '../lib/utils';

interface HomeViewProps {
  question: string;
  setQuestion: (q: string) => void;
  selectedSpread: Spread | null;
  setSelectedSpread: (s: Spread) => void;
  onStartRitual: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
  question, 
  setQuestion, 
  selectedSpread, 
  setSelectedSpread, 
  onStartRitual 
}) => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 py-12">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-tertiary/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-4xl w-full text-center z-10 space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-secondary tracking-tight">
            灵语塔罗 <span className="italic font-normal opacity-80">(AetherTarot)</span>
          </h1>
          <p className="font-serif text-xl md:text-2xl text-primary tracking-wide italic">
            开启你的探索之路
          </p>
        </motion.div>

        {/* Inquiry Field */}
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary-fixed/20 to-tertiary/20 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000"></div>
          <div className="relative flex items-center bg-surface-container-lowest rounded-full p-2 border border-outline-variant/20 focus-within:border-primary/50 transition-all duration-500">
            <span className="material-symbols-outlined ml-6 text-on-surface-variant/50">search_spark</span>
            <input 
              className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/40 px-6 py-4 text-lg" 
              placeholder="今天，你想向宇宙询问什么？" 
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button 
              onClick={onStartRitual}
              disabled={!question || !selectedSpread}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-4 rounded-full font-label font-semibold shadow-lg hover:scale-[1.02] transition-transform duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              启示
            </button>
          </div>
        </div>

        {/* Spread Selection */}
        <div className="space-y-8 pt-12">
          <h2 className="font-label text-xs uppercase tracking-[0.3em] text-secondary-fixed/60">选择你的牌阵 • Choose Your Spread</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SPREADS.map((spread) => (
              <motion.div 
                key={spread.id}
                whileHover={{ y: -5 }}
                onClick={() => setSelectedSpread(spread)}
                className={cn(
                  "glass-panel p-8 rounded-xl border transition-all duration-500 cursor-pointer group flex flex-col items-center text-center",
                  selectedSpread?.id === spread.id 
                    ? "border-secondary-fixed/40 ring-1 ring-secondary-fixed/20 bg-surface-container-low/60" 
                    : "border-outline-variant/10 hover:border-secondary-fixed/40"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-6 border transition-colors",
                  selectedSpread?.id === spread.id 
                    ? "bg-surface-container-highest border-secondary-fixed/30 text-secondary-fixed" 
                    : "bg-surface-container-high border-outline-variant/20 group-hover:text-secondary-fixed"
                )}>
                  <span className="material-symbols-outlined text-3xl">{spread.icon}</span>
                </div>
                <h3 className="font-serif text-xl text-secondary mb-3">{spread.name} ({spread.englishName})</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{spread.description}</p>
                {spread.id === 'holy-triangle' && (
                   <span className="mt-4 inline-block px-3 py-1 bg-secondary-fixed/10 text-secondary-fixed text-[10px] font-label uppercase tracking-widest rounded-full">最受青睐</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeView;
