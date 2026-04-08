"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import type {
  DrawnCard,
  ReadingErrorPayload,
  ReadingHistoryEntry,
  ReadingRequestCardInput,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";

const HISTORY_STORAGE_KEY = "aether_tarot_history_v2";

type ReadingContextValue = {
  question: string;
  selectedSpread: Spread | null;
  drawnCards: DrawnCard[];
  reading: StructuredReading | null;
  errorMessage: string | null;
  isLoading: boolean;
  history: ReadingHistoryEntry[];
  setQuestion: (question: string) => void;
  setSelectedSpread: (spread: Spread | null) => void;
  startRitual: () => boolean;
  completeRitual: (cards: DrawnCard[]) => void;
  interpretReading: () => Promise<boolean>;
  selectHistoryReading: (reading: ReadingHistoryEntry) => void;
  resetReading: () => void;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

function serializeHistory(history: ReadingHistoryEntry[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function toRequestDrawnCards(drawnCards: DrawnCard[]): ReadingRequestCardInput[] {
  return drawnCards.map((drawnCard) => ({
    positionId: drawnCard.positionId,
    cardId: drawnCard.card.id,
    isReversed: drawnCard.isReversed,
  }));
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<ReadingErrorPayload>;

  if (
    candidate.error &&
    typeof candidate.error === "object" &&
    typeof candidate.error.message === "string"
  ) {
    return candidate.error.message;
  }

  return null;
}

export function ReadingProvider({ children }: { children: ReactNode }) {
  const [question, setQuestionState] = useState("");
  const [selectedSpread, setSelectedSpreadState] = useState<Spread | null>(null);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [reading, setReading] = useState<StructuredReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  const interpretInFlightRef = useRef(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!savedHistory) {
      return;
    }

    try {
      setHistory(JSON.parse(savedHistory) as ReadingHistoryEntry[]);
    } catch {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }, []);

  const setQuestion = (value: string) => {
    setQuestionState(value);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const setSelectedSpread = (spread: Spread | null) => {
    setSelectedSpreadState(spread);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const startRitual = () => {
    if (!question.trim() || !selectedSpread) {
      return false;
    }

    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setIsLoading(false);
    return true;
  };

  const completeRitual = (cards: DrawnCard[]) => {
    setDrawnCards(cards);
    setReading(null);
    setErrorMessage(null);
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
    setErrorMessage(null);

    try {
      const requestDrawnCards = toRequestDrawnCards(drawnCards);
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          spreadId: selectedSpread.id,
          drawnCards: requestDrawnCards,
        }),
      });

      const payload = (await response.json()) as StructuredReading | ReadingErrorPayload;

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload) ?? "连接星辰时发生了偏移，请稍后再试。",
        );
      }

      const nextReading = payload as StructuredReading;

      setReading(nextReading);
      setHistory((currentHistory) => {
        const nextHistory = [
          {
            id: nextReading.reading_id,
            createdAt: new Date().toISOString(),
            spreadId: selectedSpread.id,
            drawnCards: requestDrawnCards,
            reading: nextReading,
          },
          ...currentHistory,
        ];

        serializeHistory(nextHistory);
        return nextHistory;
      });

      return true;
    } catch (error) {
      setReading(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "连接星辰时发生了偏移，请稍后再试。",
      );
      return false;
    } finally {
      setIsLoading(false);
      interpretInFlightRef.current = false;
    }
  };

  const selectHistoryReading = (historyEntry: ReadingHistoryEntry) => {
    const spread = findSpreadById(historyEntry.spreadId) ?? null;
    const reconstructedCards: DrawnCard[] = historyEntry.drawnCards
      .map((savedCard) => {
        const card = findCardById(savedCard.cardId);

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

    setQuestionState(historyEntry.reading.question);
    setSelectedSpreadState(spread);
    setDrawnCards(reconstructedCards);
    setReading(historyEntry.reading);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const resetReading = () => {
    setQuestionState("");
    setSelectedSpreadState(null);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  return (
    <ReadingContext.Provider
      value={{
        question,
        selectedSpread,
        drawnCards,
        reading,
        errorMessage,
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
