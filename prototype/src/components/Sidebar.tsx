import React from 'react';
import { Phase } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentPhase: Phase;
  onPhaseChange: (phase: Phase) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPhase, onPhaseChange }) => {
  const navItems = [
    { id: 'home', label: 'Inquiry', icon: 'auto_awesome' },
    { id: 'ritual', label: 'Ritual', icon: 'style' },
    { id: 'reveal', label: 'Reveal', icon: 'visibility' },
    { id: 'interpretation', label: 'Interpretation', icon: 'auto_stories' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-24 z-40 bg-surface-container-low/40 backdrop-blur-md flex-col items-center justify-center gap-12 py-24 border-r border-outline-variant/10">
      <div className="absolute top-8 flex flex-col items-center gap-1">
        <span className="text-secondary-fixed text-xl material-symbols-outlined">stars</span>
      </div>
      
      <nav className="flex flex-col gap-10">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPhaseChange(item.id as Phase)}
            className={cn(
              "flex flex-col items-center gap-2 transition-all duration-500 ease-in-out group",
              currentPhase === item.id 
                ? "text-secondary-fixed scale-110 drop-shadow-[0_0_10px_rgba(233,196,0,0.5)]" 
                : "text-outline-variant hover:text-primary"
            )}
          >
            <span className={cn(
              "material-symbols-outlined text-2xl",
              currentPhase === item.id && "fill-1"
            )}>
              {item.icon}
            </span>
            <span className="font-label text-[10px] uppercase tracking-[0.2em]">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pb-8">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/30">
          <img 
            alt="User Profile" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6WnnsSpR4-nVZumwdLvhtNWjs_lT-hPBVD2OFKZfSvzFU32TvAC7gVuH8zRzfky7HLynbZMAJ_MlZ-XO3fTxbkWOcFT1b4x-cP0AUZqADjEm7EJI026kHPJZSukyd-upQ77z6lEj5w5_sJJr1foOjW6J5E3HSCgMEPtpewRJYa8ZUFjn8x7jz0pewgJBju-nOYPPTzLouTHyjCCuTr_jwyab2UJHtJsqaP7ZsYgueANfssUnKjU50cWqlAuIdLwL2qzzBjspEysJK"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
