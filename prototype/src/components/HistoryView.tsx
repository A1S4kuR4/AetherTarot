import React from 'react';
import { Reading } from '../types';
import { SPREADS } from '../constants';

interface HistoryViewProps {
  readings: Reading[];
  onSelectReading: (reading: Reading) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ readings, onSelectReading }) => {
  return (
    <section className="w-full max-w-4xl mx-auto p-8 lg:p-12">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-secondary mb-2">占卜历史</h1>
        <p className="font-body text-on-surface-variant text-sm opacity-80 uppercase tracking-widest">Reading History</p>
      </header>

      <div className="space-y-6">
        {readings.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant italic">
            暂无占卜记录，开启你的第一次探索吧。
          </div>
        ) : (
          readings.map((reading) => (
            <div 
              key={reading.id}
              onClick={() => onSelectReading(reading)}
              className="group relative p-6 bg-surface-container rounded-xl transition-all duration-500 hover:bg-surface-container-highest/60 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex gap-5 items-start">
                <div className="w-20 h-28 rounded-lg overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shrink-0">
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSlNznSxIu7WuOoxcEEfVuzf0rnx-2tut032cZfimcZNo8AOmjM-H4Vot7Vb72v36SHTzqWLzmtJSYCO9B8bq8mlIoyVugdlbeHH7m7YjXUF1rvoxA0XDfHwYs8jBXszmjE6-CMLBPq3aH1LLDmPW7AH5nP3qHSerfzFD4in0mW9CE23AAIVn-vANEv6HAZlq2UOZxI4W0oqs9wcsJc-u-jUmQHgNIjnE-It8Ei93R0zixucnZDlV2MTTmlRBYremEFCmI9KxeeclQ" 
                    alt="Reading"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-label text-[10px] text-secondary-fixed/60 uppercase tracking-widest">{reading.date}</span>
                    <span className="material-symbols-outlined text-secondary-fixed text-sm opacity-0 group-hover:opacity-100 transition-opacity">north_east</span>
                  </div>
                  <h3 className="font-serif text-xl text-primary mb-2">
                    {SPREADS.find(s => s.id === reading.spreadId)?.name}
                  </h3>
                  <p className="font-body text-sm text-on-surface-variant line-clamp-2 italic">“{reading.question}”</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default HistoryView;
