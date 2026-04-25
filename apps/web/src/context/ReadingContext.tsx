"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { findCardById, findSpreadById } from "@aethertarot/domain-tarot";
import type {
  AgentProfile,
  DrawSource,
  DrawnCard,
  FollowupAnswer,
  ReadingErrorPayload,
  ReadingHistoryEntry,
  ReadingRequestCardInput,
  Spread,
  StructuredReading,
} from "@aethertarot/shared-types";

const HISTORY_STORAGE_KEY = "aether_tarot_history_v3";
const LEGACY_HISTORY_STORAGE_KEY = "aether_tarot_history_v2";
const DEFAULT_AGENT_PROFILE: AgentProfile = "standard";
const DEFAULT_DRAW_SOURCE: DrawSource = "digital_random";
const EMPTY_SOBER_GATE: SoberGateState = {
  readingId: null,
  input: "",
  isPassed: false,
};

type SoberGateState = {
  readingId: string | null;
  input: string;
  isPassed: boolean;
};

export type ContinuitySource = {
  readingId: string;
  capsule: string;
  question: string;
  spreadName: string;
  themes: string[];
};

type ReadingContextValue = {
  question: string;
  selectedSpread: Spread | null;
  agentProfile: AgentProfile;
  drawSource: DrawSource;
  drawnCards: DrawnCard[];
  reading: StructuredReading | null;
  errorMessage: string | null;
  safetyIntercept: { reason: string; referral_links?: string[] } | null;
  soberGate: SoberGateState;
  continuitySource: ContinuitySource | null;
  setSoberGate: (gate: SoberGateState) => void;
  isLoading: boolean;
  isHydrated: boolean;
  history: ReadingHistoryEntry[];
  setQuestion: (question: string) => void;
  setSelectedSpread: (spread: Spread | null) => void;
  setAgentProfile: (profile: AgentProfile) => void;
  setDrawSource: (source: DrawSource) => void;
  startRitual: () => boolean;
  completeRitual: (cards: DrawnCard[]) => void;
  interpretReading: () => Promise<boolean>;
  submitFollowupAnswers: (answers: FollowupAnswer[]) => Promise<boolean>;
  selectHistoryReading: (reading: ReadingHistoryEntry) => void;
  continueFromHistoryReading: (reading: ReadingHistoryEntry) => boolean;
  clearContinuitySource: () => void;
  resetReading: () => void;
  updateHistoryNotes: (id: string, notes: string) => void;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

type HydrationAwareWindow = Window & {
  __AETHERTAROT_READING_HYDRATED__?: boolean;
};

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

function getReadingAgentProfile(reading: StructuredReading | null) {
  return reading?.agent_profile ?? DEFAULT_AGENT_PROFILE;
}

function buildContinuitySource(reading: StructuredReading): ContinuitySource | null {
  if (!reading.session_capsule) {
    return null;
  }

  return {
    readingId: reading.reading_id,
    capsule: reading.session_capsule,
    question: reading.question,
    spreadName: reading.spread.name,
    themes: reading.themes,
  };
}

export function ReadingProvider({ children }: { children: ReactNode }) {
  const [question, setQuestionState] = useState("");
  const [selectedSpread, setSelectedSpreadState] = useState<Spread | null>(null);
  const [agentProfile, setAgentProfileState] = useState<AgentProfile>(DEFAULT_AGENT_PROFILE);
  const [drawSource, setDrawSourceState] = useState<DrawSource>(DEFAULT_DRAW_SOURCE);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [reading, setReading] = useState<StructuredReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [safetyIntercept, setSafetyIntercept] = useState<{ reason: string; referral_links?: string[] } | null>(null);
  const [soberGate, setSoberGate] = useState<SoberGateState>(EMPTY_SOBER_GATE);
  const [continuitySource, setContinuitySource] = useState<ContinuitySource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  const interpretInFlightRef = useRef(false);
  const interpretSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const savedHistory =
      localStorage.getItem(HISTORY_STORAGE_KEY)
      ?? localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);

    if (!savedHistory) {
      setIsHydrated(true);
      return;
    }

    try {
      setHistory(JSON.parse(savedHistory) as ReadingHistoryEntry[]);
    } catch {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    (window as HydrationAwareWindow).__AETHERTAROT_READING_HYDRATED__ = isHydrated;
  }, [isHydrated]);

  const persistCompletedReading = useCallback((nextReading: StructuredReading) => {
    if (!selectedSpread) {
      return;
    }

    const requestDrawnCards = toRequestDrawnCards(drawnCards);

    setHistory((currentHistory) => {
      const nextHistory = [
        {
          id: nextReading.reading_id,
          createdAt: new Date().toISOString(),
          spreadId: selectedSpread.id,
          drawSource,
          drawnCards: requestDrawnCards,
          reading: nextReading,
        },
        ...currentHistory,
      ];

      serializeHistory(nextHistory);
      return nextHistory;
    });
  }, [drawSource, drawnCards, selectedSpread]);

  const clearGeneratedState = () => {
    interpretSignatureRef.current = null;
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const setQuestion = (value: string) => {
    setQuestionState(value);
    clearGeneratedState();
  };

  const setSelectedSpread = (spread: Spread | null) => {
    setSelectedSpreadState(spread);
    clearGeneratedState();
  };

  const setAgentProfile = (profile: AgentProfile) => {
    setAgentProfileState(profile);
    clearGeneratedState();
  };

  const setDrawSource = (source: DrawSource) => {
    setDrawSourceState(source);
    clearGeneratedState();
  };

  const startRitual = () => {
    if (!question.trim() || !selectedSpread) {
      return false;
    }

    clearGeneratedState();
    return true;
  };

  const completeRitual = (cards: DrawnCard[]) => {
    interpretSignatureRef.current = null;
    setDrawnCards(cards);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const interpretReading = useCallback(async () => {
    if (
      interpretInFlightRef.current ||
      !question.trim() ||
      !selectedSpread ||
      drawnCards.length === 0
    ) {
      return false;
    }

      const requestDrawnCards = toRequestDrawnCards(drawnCards);
    const requestSignature = JSON.stringify({
      question: question.trim(),
      spreadId: selectedSpread.id,
      drawnCards: requestDrawnCards,
      agent_profile: agentProfile,
      phase: "initial",
      draw_source: drawSource,
      prior_session_capsule: continuitySource?.capsule ?? null,
    });

    if (interpretSignatureRef.current === requestSignature) {
      return false;
    }

    interpretInFlightRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSafetyIntercept(null);
    interpretSignatureRef.current = requestSignature;

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          spreadId: selectedSpread.id,
          drawnCards: requestDrawnCards,
          agent_profile: agentProfile,
          phase: "initial",
          draw_source: drawSource,
          prior_session_capsule: continuitySource?.capsule ?? null,
        }),
      });

      const payload = (await response.json()) as StructuredReading | ReadingErrorPayload;

      if (!response.ok) {
        if (payload && "error" in payload && payload.error?.code === "safety_intercept") {
          setSafetyIntercept({
            reason: payload.error.intercept_reason ?? payload.error.message,
            referral_links: payload.error.referral_links,
          });
          return false;
        }

        throw new Error(
          getErrorMessage(payload) ?? "连接星辰时发生了偏移，请稍后再试。",
        );
      }

      const nextReading = payload as StructuredReading;

      setReading(nextReading);

      if (!nextReading.requires_followup) {
        persistCompletedReading(nextReading);
      }

      return true;
    } catch (error) {
      interpretSignatureRef.current = null;
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
  }, [agentProfile, continuitySource, drawSource, drawnCards, persistCompletedReading, question, selectedSpread]);

  const submitFollowupAnswers = useCallback(async (answers: FollowupAnswer[]) => {
    if (
      interpretInFlightRef.current ||
      !question.trim() ||
      !selectedSpread ||
      drawnCards.length === 0 ||
      !reading ||
      reading.reading_phase !== "initial"
    ) {
      return false;
    }

    const requestDrawnCards = toRequestDrawnCards(drawnCards);
    const requestSignature = JSON.stringify({
      question: question.trim(),
      spreadId: selectedSpread.id,
      drawnCards: requestDrawnCards,
      agent_profile: getReadingAgentProfile(reading),
      phase: "final",
      draw_source: drawSource,
      initial_reading_id: reading.reading_id,
      followup_answers: answers,
      prior_session_capsule: continuitySource?.capsule ?? null,
    });

    if (interpretSignatureRef.current === requestSignature) {
      return false;
    }

    interpretInFlightRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSafetyIntercept(null);
    interpretSignatureRef.current = requestSignature;

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          spreadId: selectedSpread.id,
          drawnCards: requestDrawnCards,
          agent_profile: getReadingAgentProfile(reading),
          phase: "final",
          draw_source: drawSource,
          prior_session_capsule: continuitySource?.capsule ?? null,
          initial_reading: reading,
          followup_answers: answers,
        }),
      });

      const payload = (await response.json()) as StructuredReading | ReadingErrorPayload;

      if (!response.ok) {
        if (payload && "error" in payload && payload.error?.code === "safety_intercept") {
          setSafetyIntercept({
            reason: payload.error.intercept_reason ?? payload.error.message,
            referral_links: payload.error.referral_links,
          });
          return false;
        }

        throw new Error(
          getErrorMessage(payload) ?? "连接星辰时发生了偏移，请稍后再试。",
        );
      }

      const nextReading = payload as StructuredReading;
      const wasSoberUnlocked = soberGate.readingId === reading.reading_id && soberGate.isPassed;

      setReading(nextReading);

      if (nextReading.sober_check && wasSoberUnlocked) {
        setSoberGate({
          readingId: nextReading.reading_id,
          input: soberGate.input,
          isPassed: true,
        });
      }

      persistCompletedReading(nextReading);
      return true;
    } catch (error) {
      interpretSignatureRef.current = null;
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
  }, [continuitySource, drawSource, drawnCards, persistCompletedReading, question, reading, selectedSpread, soberGate.input, soberGate.isPassed, soberGate.readingId]);

  const selectHistoryReading = (historyEntry: ReadingHistoryEntry) => {
    interpretSignatureRef.current = null;
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
    setAgentProfileState(historyEntry.reading.agent_profile ?? DEFAULT_AGENT_PROFILE);
    setDrawSourceState(historyEntry.drawSource ?? DEFAULT_DRAW_SOURCE);
    setDrawnCards(reconstructedCards);
    setReading(historyEntry.reading);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const continueFromHistoryReading = (historyEntry: ReadingHistoryEntry) => {
    const nextContinuitySource = buildContinuitySource(historyEntry.reading);

    if (!nextContinuitySource) {
      return false;
    }

    interpretSignatureRef.current = null;
    setQuestionState("");
    setSelectedSpreadState(null);
    setAgentProfileState(DEFAULT_AGENT_PROFILE);
    setDrawSourceState(DEFAULT_DRAW_SOURCE);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
    setContinuitySource(nextContinuitySource);

    return true;
  };

  const clearContinuitySource = () => {
    setContinuitySource(null);
  };

  const resetReading = () => {
    interpretSignatureRef.current = null;
    setQuestionState("");
    setSelectedSpreadState(null);
    setAgentProfileState(DEFAULT_AGENT_PROFILE);
    setDrawSourceState(DEFAULT_DRAW_SOURCE);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const updateHistoryNotes = (id: string, notes: string) => {
    setHistory((currentHistory) => {
      const nextHistory = currentHistory.map((entry) =>
        entry.id === id ? { ...entry, user_notes: notes } : entry
      );
      serializeHistory(nextHistory);
      return nextHistory;
    });
  };

  return (
    <ReadingContext.Provider
      value={{
        question,
        selectedSpread,
        agentProfile,
        drawSource,
        drawnCards,
        reading,
        errorMessage,
        safetyIntercept,
        soberGate,
        continuitySource,
        setSoberGate,
        isLoading,
        isHydrated,
        history,
        setQuestion,
        setSelectedSpread,
        setAgentProfile,
        setDrawSource,
        startRitual,
        completeRitual,
        interpretReading,
        submitFollowupAnswers,
        selectHistoryReading,
        continueFromHistoryReading,
        clearContinuitySource,
        resetReading,
        updateHistoryNotes,
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
