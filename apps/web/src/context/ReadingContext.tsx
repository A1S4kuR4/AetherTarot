"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SPREADS, TAROT_CARDS } from "@/constants";
import type { DrawnCard, Reading, Spread } from "@/types";

const HISTORY_STORAGE_KEY = "aether_tarot_history";

type ReadingContextValue = {
  question: string;
  selectedSpread: Spread | null;
  drawnCards: DrawnCard[];
  interpretation: string;
  isLoading: boolean;
  history: Reading[];
  setQuestion: (question: string) => void;
  setSelectedSpread: (spread: Spread | null) => void;
  startRitual: () => boolean;
  completeRitual: (cards: DrawnCard[]) => void;
  interpretReading: () => Promise<boolean>;
  selectHistoryReading: (reading: Reading) => void;
  resetReading: () => void;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

function serializeHistory(history: Reading[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function ReadingProvider({ children }: { children: ReactNode }) {
  const [question, setQuestionState] = useState("");
  const [selectedSpread, setSelectedSpreadState] = useState<Spread | null>(null);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Reading[]>([]);
  const interpretInFlightRef = useRef(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!savedHistory) {
      return;
    }

    try {
      setHistory(JSON.parse(savedHistory) as Reading[]);
    } catch {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }, []);

  const setQuestion = (value: string) => {
    setQuestionState(value);
    setDrawnCards([]);
    setInterpretation("");
    setIsLoading(false);
  };

  const setSelectedSpread = (spread: Spread | null) => {
    setSelectedSpreadState(spread);
    setDrawnCards([]);
    setInterpretation("");
    setIsLoading(false);
  };

  const startRitual = () => {
    if (!question.trim() || !selectedSpread) {
      return false;
    }

    setDrawnCards([]);
    setInterpretation("");
    setIsLoading(false);
    return true;
  };

  const completeRitual = (cards: DrawnCard[]) => {
    setDrawnCards(cards);
    setInterpretation("");
    setIsLoading(false);
  };

  const interpretReading = async () => {
    if (
      interpretInFlightRef.current ||
      !question.trim() ||
      !selectedSpread ||
      drawnCards.length === 0
    ) {
      return false;
    }

    interpretInFlightRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          spread: selectedSpread,
          drawnCards,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to interpret reading.");
      }

      const payload = (await response.json()) as { interpretation: string };
      const result = payload.interpretation;

      setInterpretation(result);
      setHistory((currentHistory) => {
        const nextHistory = [
          {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            question,
            spreadId: selectedSpread.id,
            cards: drawnCards.map((card) => ({
              positionId: card.positionId,
              cardId: card.card.id,
              isReversed: card.isReversed,
            })),
            interpretation: result,
          },
          ...currentHistory,
        ];

        serializeHistory(nextHistory);
        return nextHistory;
      });

      return true;
    } catch {
      setInterpretation("连接星辰时发生了偏移，请稍后再试。");
      return false;
    } finally {
      setIsLoading(false);
      interpretInFlightRef.current = false;
    }
  };

  const selectHistoryReading = (reading: Reading) => {
    const spread = SPREADS.find((item) => item.id === reading.spreadId) ?? null;
    const reconstructedCards: DrawnCard[] = reading.cards
      .map((savedCard) => {
        const card = TAROT_CARDS.find((item) => item.id === savedCard.cardId);

        if (!card) {
          return null;
        }

        return {
          positionId: savedCard.positionId,
          card,
          isReversed: savedCard.isReversed,
        };
      })
      .filter((card): card is DrawnCard => card !== null);

    setQuestionState(reading.question);
    setSelectedSpreadState(spread);
    setDrawnCards(reconstructedCards);
    setInterpretation(reading.interpretation);
    setIsLoading(false);
  };

  const resetReading = () => {
    setQuestionState("");
    setSelectedSpreadState(null);
    setDrawnCards([]);
    setInterpretation("");
    setIsLoading(false);
  };

  return (
    <ReadingContext.Provider
      value={{
        question,
        selectedSpread,
        drawnCards,
        interpretation,
        isLoading,
        history,
        setQuestion,
        setSelectedSpread,
        startRitual,
        completeRitual,
        interpretReading,
        selectHistoryReading,
        resetReading,
      }}
    >
      {children}
    </ReadingContext.Provider>
  );
}

export function useReading() {
  const context = useContext(ReadingContext);

  if (!context) {
    throw new Error("useReading must be used within a ReadingProvider.");
  }

  return context;
}
