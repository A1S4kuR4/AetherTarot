import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import HomeView from './components/HomeView';
import RitualView from './components/RitualView';
import RevealView from './components/RevealView';
import InterpretationView from './components/InterpretationView';
import HistoryView from './components/HistoryView';
import EncyclopediaView from './components/EncyclopediaView';
import { Phase, Spread, TarotCard, Reading } from './types';
import { generateTarotInterpretation } from './services/geminiService';

const App: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<Phase>('home');
  const [question, setQuestion] = useState('');
  const [selectedSpread, setSelectedSpread] = useState<Spread | null>(null);
  const [drawnCards, setDrawnCards] = useState<{ positionId: string; card: TarotCard; isReversed: boolean }[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Reading[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('aether_tarot_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (reading: Reading) => {
    const newHistory = [reading, ...history];
    setHistory(newHistory);
    localStorage.setItem('aether_tarot_history', JSON.stringify(newHistory));
  };

  const handleStartRitual = () => {
    if (question && selectedSpread) {
      setCurrentPhase('ritual');
    }
  };

  const handleRitualComplete = (cards: { positionId: string; card: TarotCard; isReversed: boolean }[]) => {
    setDrawnCards(cards);
    setCurrentPhase('reveal');
  };

  const handleInterpret = async () => {
    if (!selectedSpread || drawnCards.length === 0) return;
    
    setCurrentPhase('interpretation');
    setIsLoading(true);
    
    const drawnWithNames = drawnCards.map(d => ({
      positionName: selectedSpread.positions.find(p => p.id === d.positionId)?.name || '',
      card: d.card,
      isReversed: d.isReversed
    }));

    const result = await generateTarotInterpretation(question, selectedSpread, drawnWithNames);
    setInterpretation(result);
    setIsLoading(false);

    // Save to history
    const newReading: Reading = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      question,
      spreadId: selectedSpread.id,
      cards: drawnCards.map(d => ({ positionId: d.positionId, cardId: d.card.id, isReversed: d.isReversed })),
      interpretation: result
    };
    saveToHistory(newReading);
  };

  const handleSelectHistoryReading = (reading: Reading) => {
    // This is a simplified view for history
    setQuestion(reading.question);
    setInterpretation(reading.interpretation);
    setCurrentPhase('interpretation');
  };

  const renderPhase = () => {
    switch (currentPhase) {
      case 'home':
        return (
          <HomeView 
            question={question} 
            setQuestion={setQuestion} 
            selectedSpread={selectedSpread} 
            setSelectedSpread={setSelectedSpread} 
            onStartRitual={handleStartRitual} 
          />
        );
      case 'ritual':
        return selectedSpread && (
          <RitualView 
            spread={selectedSpread} 
            onComplete={handleRitualComplete} 
          />
        );
      case 'reveal':
        return selectedSpread && (
          <RevealView 
            spread={selectedSpread} 
            drawnCards={drawnCards} 
            onInterpret={handleInterpret} 
          />
        );
      case 'interpretation':
        return selectedSpread && (
          <InterpretationView 
            question={question} 
            spread={selectedSpread} 
            drawnCards={drawnCards} 
            interpretation={interpretation}
            isLoading={isLoading}
          />
        );
      case 'history':
        return (
          <HistoryView 
            readings={history} 
            onSelectReading={handleSelectHistoryReading} 
          />
        );
      case 'encyclopedia':
        return <EncyclopediaView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen celestial-bg selection:bg-primary/30">
      <Sidebar currentPhase={currentPhase} onPhaseChange={setCurrentPhase} />
      <Topbar currentPhase={currentPhase} onPhaseChange={setCurrentPhase} />
      
      <main className="md:pl-24 pt-20 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Decorative Elements */}
      <div className="fixed bottom-8 right-8 z-50 flex gap-4">
        <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center border border-outline-variant/20 text-secondary-fixed animate-pulse">
          <span className="material-symbols-outlined text-xl">auto_awesome</span>
        </div>
      </div>
    </div>
  );
};

export default App;
