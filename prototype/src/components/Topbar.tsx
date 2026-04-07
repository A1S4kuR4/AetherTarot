import React from 'react';
import { Phase } from '../types';

interface TopbarProps {
  currentPhase: Phase;
  onPhaseChange: (phase: Phase) => void;
}

const Topbar: React.FC<TopbarProps> = ({ currentPhase, onPhaseChange }) => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl flex justify-between items-center px-8 h-20 shadow-[0_4px_30px_rgba(228,225,237,0.06)]">
      <div className="flex items-center gap-2">
        <span className="font-serif text-2xl italic text-primary drop-shadow-[0_0_8px_rgba(203,190,255,0.4)]">AetherTarot</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 font-label tracking-wide">
        <button 
          onClick={() => onPhaseChange('history')}
          className="text-on-surface-variant hover:text-primary transition-colors duration-500"
        >
          History
        </button>
        <button 
          onClick={() => onPhaseChange('encyclopedia')}
          className="text-on-surface-variant hover:text-primary transition-colors duration-500"
        >
          Encyclopedia
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-surface-container-highest/40 transition-all duration-300">
          <span className="material-symbols-outlined text-primary">account_circle</span>
        </button>
      </div>
    </nav>
  );
};

export default Topbar;
