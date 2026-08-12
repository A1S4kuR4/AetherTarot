"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { findCardById, findSpreadById, getAllSpreads } from "@aethertarot/domain-tarot";
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
import { restoreAgentProfile } from "@aethertarot/shared-types";
import {
  buildReadingDraftSnapshot,
  parseReadingDraftSnapshot,
  READING_DRAFT_STORAGE_KEY,
} from "@/lib/reading-draft-storage";
import { fetchJsonWithTimeout } from "@/lib/fetch-json-with-timeout";
import { trackGrowthReadingCompleted } from "@/lib/growth-attribution";
import { isQuickReadingState } from "@/lib/quickReadingFlow";
import {
  enqueueAccountReading,
  readAccountReadingOutbox,
  removeAccountReadingFromOutbox,
} from "@/lib/account-reading-outbox";
import {
  IdentityRequestLifecycle,
  type IdentityRequest,
} from "@/lib/identity-request-lifecycle";
import {
  GUEST_HISTORY_STORAGE_KEY,
  mergeGuestHistoryEntry,
  readGuestHistory,
} from "@/lib/guest-reading-history";
import {
  loadIdentityHistory,
  saveIdentityNotes,
  type ReadingIdentity,
} from "@/lib/identity-reading-history";

const READING_DRAFT_IDENTITY_KEY = "aether_tarot_reading_draft_identity_v1";
const DEFAULT_AGENT_PROFILE: AgentProfile = "standard";
const DEFAULT_DRAW_SOURCE: DrawSource = "digital_random";
const allSpreads = getAllSpreads();
const DEFAULT_SPREAD: Spread | null =
  allSpreads.find((spread) => spread.id === "single") ?? allSpreads[0] ?? null;
const READING_REQUEST_TIMEOUT_MS = 130_000;
const READING_REQUEST_TIMEOUT_MESSAGE =
  "解读生成等待超时。请检查网络后重新尝试；刚才的牌阵还在，重试不会重复扣除次数。";
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
  threadId: string;
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
  historySyncError: string | null;
  retryHistorySync: () => Promise<boolean>;
  setQuestion: (question: string) => void;
  setSelectedSpread: (spread: Spread | null) => void;
  setAgentProfile: (profile: AgentProfile) => void;
  setDrawSource: (source: DrawSource) => void;
  startRitual: () => boolean;
  startDailyRitual: (dailyQuestion: string, spreadId: string) => boolean;
  completeRitual: (cards: DrawnCard[]) => void;
  interpretReading: () => Promise<boolean>;
  submitFollowupAnswers: (answers: FollowupAnswer[]) => Promise<boolean>;
  selectHistoryReading: (reading: ReadingHistoryEntry) => void;
  continueFromHistoryReading: (reading: ReadingHistoryEntry) => boolean;
  clearContinuitySource: () => void;
  clearContinuityMemory: () => Promise<boolean>;
  resetReading: () => void;
  updateHistoryNotes: (id: string, notes: string) => Promise<"saved_to_browser" | "synced">;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

type HydrationAwareWindow = Window & {
  __AETHERTAROT_READING_HYDRATED__?: boolean;
};

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
  return restoreAgentProfile(reading?.agent_profile, (original, fallback) => {
    const valueType = original === null
      ? "null"
      : Array.isArray(original)
        ? "array"
        : typeof original;

    console.warn(
      "[ReadingContext] unknown agent_profile in history/continuity; falling back to",
      fallback,
      { valueType },
    );
  });
}

function normalizeReadingAgentProfile(reading: StructuredReading) {
  const agentProfile = getReadingAgentProfile(reading);

  return reading.agent_profile === agentProfile
    ? reading
    : { ...reading, agent_profile: agentProfile };
}

function normalizeHistoryEntry(entry: ReadingHistoryEntry) {
  const reading = normalizeReadingAgentProfile(entry.reading);
  return reading === entry.reading ? entry : { ...entry, reading };
}

function normalizeHistoryEntries(entries: ReadingHistoryEntry[]) {
  return entries.map(normalizeHistoryEntry);
}

function buildContinuitySource(
  entry: ReadingHistoryEntry,
): ContinuitySource | null {
  const reading = entry.reading;
  if (!reading.session_capsule) {
    return null;
  }

  return {
    readingId: reading.reading_id,
    threadId: entry.threadId ?? crypto.randomUUID(),
    capsule: reading.session_capsule,
    question: reading.question,
    spreadName: reading.spread.name,
    themes: reading.themes,
  };
}

function readActiveReadingDraft(identityKey: string) {
  try {
    if (sessionStorage.getItem(READING_DRAFT_IDENTITY_KEY) !== identityKey) {
      return null;
    }
    return parseReadingDraftSnapshot(
      sessionStorage.getItem(READING_DRAFT_STORAGE_KEY),
      {
        findSpreadById,
        findCardById,
      },
    );
  } catch {
    return null;
  }
}

function clearActiveReadingDraft() {
  try {
    sessionStorage.removeItem(READING_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(READING_DRAFT_IDENTITY_KEY);
  } catch {
    // Storage can be unavailable.
  }
}

function createReadingRequestId() {
  return crypto.randomUUID();
}

export function ReadingProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();

  if (sessionStatus === "loading") {
    return <div aria-busy="true" data-testid="reading-identity-loading" />;
  }

  const identityKey = sessionStatus === "authenticated" && session?.user?.id
    ? `account:${session.user.id}`
    : "guest";

  return (
    <IdentityScopedReadingProvider key={identityKey} identityKey={identityKey}>
      {children}
    </IdentityScopedReadingProvider>
  );
}

function IdentityScopedReadingProvider({
  children,
  identityKey,
}: {
  children: ReactNode;
  identityKey: string;
}) {
  const [question, setQuestionState] = useState("");
  const [selectedSpread, setSelectedSpreadState] = useState<Spread | null>(DEFAULT_SPREAD);
  const [agentProfile, setAgentProfileState] = useState<AgentProfile>(DEFAULT_AGENT_PROFILE);
  const [drawSource, setDrawSourceState] = useState<DrawSource>(DEFAULT_DRAW_SOURCE);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [reading, setReading] = useState<StructuredReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [safetyIntercept, setSafetyIntercept] = useState<{ reason: string; referral_links?: string[] } | null>(null);
  const [soberGate, setSoberGate] = useState<SoberGateState>(EMPTY_SOBER_GATE);
  const isQuestionlessQuickReading = isQuickReadingState({
    agentProfile,
    selectedSpread,
    drawnCards,
  });
  const [continuitySource, setContinuitySource] = useState<ContinuitySource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  const [historySyncError, setHistorySyncError] = useState<string | null>(null);
  const identityLifecycleRef = useRef(new IdentityRequestLifecycle(identityKey));
  const renderedIdentityRef = useRef(identityKey);
  const interpretInFlightRef = useRef<IdentityRequest | null>(null);
  const interpretSignatureRef = useRef<string | null>(null);
  const initialRequestIdRef = useRef<string | null>(null);
  const finalRequestIdentityRef = useRef<{ signature: string; requestId: string } | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

  const isCurrentIdentityRequest = useCallback((request: IdentityRequest) =>
    identityLifecycleRef.current.isCurrent(request, renderedIdentityRef.current), []);

  useLayoutEffect(() => {
    const lifecycle = identityLifecycleRef.current;
    renderedIdentityRef.current = identityKey;
    lifecycle.transition(identityKey);
    return () => lifecycle.dispose();
  }, [identityKey]);

  useEffect(() => {
    identityLifecycleRef.current.transition(identityKey);
    const hydrateRequest = identityLifecycleRef.current.begin(identityKey);

    async function hydrate() {
      try {
        const scopedHistory = await loadIdentityHistory({
          identity: identityKey === "guest"
            ? { kind: "guest" }
            : { kind: "account", id: identityKey.slice("account:".length) },
          storage: localStorage,
          fetchImplementation: fetch,
          signal: hydrateRequest.signal,
        });
        if (isCurrentIdentityRequest(hydrateRequest)) {
          const pending = identityKey === "guest"
            ? []
            : readAccountReadingOutbox(localStorage, identityKey.slice("account:".length));
          setHistory(normalizeHistoryEntries([
            ...pending,
            ...scopedHistory.filter((entry) => !pending.some((item) => item.id === entry.id)),
          ]));
          if (pending.length > 0) {
            setHistorySyncError(`有 ${pending.length} 条账号历史仍待同步。`);
          }
        }
      } catch {
        if (isCurrentIdentityRequest(hydrateRequest)) setHistory([]);
      } finally {
        if (isCurrentIdentityRequest(hydrateRequest)) {
          const restoredDraft = readActiveReadingDraft(identityKey);

          if (restoredDraft) {
            initialRequestIdRef.current = restoredDraft.requestId ?? createReadingRequestId();
            activeThreadIdRef.current =
              restoredDraft.threadId ?? crypto.randomUUID();
            finalRequestIdentityRef.current = null;
            setQuestionState(restoredDraft.question);
            setSelectedSpreadState(restoredDraft.selectedSpread);
            setAgentProfileState(restoredDraft.agentProfile);
            setDrawSourceState(restoredDraft.drawSource);
            setDrawnCards(restoredDraft.drawnCards);
            setReading(null);
            setErrorMessage(null);
            setSafetyIntercept(null);
            setSoberGate(EMPTY_SOBER_GATE);
            interpretSignatureRef.current = null;
          }

          setIsHydrated(true);
          (window as HydrationAwareWindow).__AETHERTAROT_READING_HYDRATED__ = true;
        }
        hydrateRequest.finish();
      }
    }

    hydrate();

    return () => {
      hydrateRequest.cancel();
    };
  }, [identityKey, isCurrentIdentityRequest]);

  useEffect(() => {
    if (identityKey !== "guest") return;
    const syncGuestHistory = (event: StorageEvent) => {
      if (event.key === GUEST_HISTORY_STORAGE_KEY) {
        setHistory(normalizeHistoryEntries(readGuestHistory(localStorage)));
      }
    };
    window.addEventListener("storage", syncGuestHistory);
    return () => window.removeEventListener("storage", syncGuestHistory);
  }, [identityKey]);

  useEffect(() => {
    (window as HydrationAwareWindow).__AETHERTAROT_READING_HYDRATED__ = isHydrated;
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (
      (!question.trim() && !isQuestionlessQuickReading)
      || !selectedSpread
      || drawnCards.length === 0
      || reading
    ) {
      clearActiveReadingDraft();
      return;
    }

    try {
      const requestId = initialRequestIdRef.current ?? createReadingRequestId();
      const threadId = activeThreadIdRef.current ?? crypto.randomUUID();
      initialRequestIdRef.current = requestId;
      activeThreadIdRef.current = threadId;
      sessionStorage.setItem(
        READING_DRAFT_STORAGE_KEY,
        JSON.stringify(buildReadingDraftSnapshot({
          requestId,
          threadId,
          question,
          selectedSpread,
          agentProfile,
          drawSource,
          drawnCards,
        })),
      );
      sessionStorage.setItem(READING_DRAFT_IDENTITY_KEY, identityKey);
    } catch {
      // Storage can be unavailable.
    }
  }, [agentProfile, drawSource, drawnCards, identityKey, isHydrated, isQuestionlessQuickReading, question, reading, selectedSpread]);

  const persistCompletedReading = useCallback(async (
    nextReading: StructuredReading,
    sourceRequest?: IdentityRequest,
  ) => {
    if (!selectedSpread || (sourceRequest && !isCurrentIdentityRequest(sourceRequest))) {
      return;
    }

    const canonicalReading = normalizeReadingAgentProfile(nextReading);
    const requestDrawnCards = toRequestDrawnCards(drawnCards);
    const newEntry: ReadingHistoryEntry = {
      id: canonicalReading.reading_id,
      createdAt: new Date().toISOString(),
      spreadId: selectedSpread.id,
      drawSource,
      drawnCards: requestDrawnCards,
      reading: canonicalReading,
      threadId: activeThreadIdRef.current ?? undefined,
    };

    if (identityKey === "guest") {
      try {
        if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
        const merged = await mergeGuestHistoryEntry(
          localStorage,
          newEntry,
          undefined,
          () => !sourceRequest || isCurrentIdentityRequest(sourceRequest),
        );
        if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
        setHistory(normalizeHistoryEntries(merged));
        setHistorySyncError(null);
      } catch {
        if (!sourceRequest || isCurrentIdentityRequest(sourceRequest)) {
          setHistorySyncError("本机保存失败，请保持当前页面并稍后重试。");
        }
      }
      return;
    }

    if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
    const accountId = identityKey.slice("account:".length);
    setHistory((current) => [newEntry, ...current.filter((entry) => entry.id !== newEntry.id)]);
    let outboxSaved = false;
    try {
      await enqueueAccountReading(
        localStorage,
        accountId,
        newEntry,
        undefined,
        () => !sourceRequest || isCurrentIdentityRequest(sourceRequest),
      );
      if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
      outboxSaved = true;
      setHistorySyncError("账号历史正在等待同步。");
    } catch {
      if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
      setHistorySyncError("本机保存失败；账号记录尚未同步，请保持当前页面并重试。");
    }

    if (sourceRequest && !isCurrentIdentityRequest(sourceRequest)) return;
    const saveRequest = identityLifecycleRef.current.begin(identityKey);
    try {
      const response = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry),
        signal: saveRequest.signal,
      });
      if (!isCurrentIdentityRequest(saveRequest)) return;
      if (!response.ok) throw new Error("账号历史同步失败，请稍后重试。");
      if (outboxSaved) {
        await removeAccountReadingFromOutbox(
          localStorage,
          accountId,
          newEntry.id,
          undefined,
          () => isCurrentIdentityRequest(saveRequest),
        );
      }
      if (!isCurrentIdentityRequest(saveRequest)) return;
      setHistorySyncError(null);
    } catch {
      if (!isCurrentIdentityRequest(saveRequest)) return;
      setHistorySyncError(outboxSaved
        ? "账号同步失败，记录仍待同步并保存在此浏览器。"
        : "本机保存失败；账号记录尚未同步，请保持当前页面并重试。"
      );
    } finally {
      saveRequest.finish();
    }
  }, [drawSource, drawnCards, identityKey, isCurrentIdentityRequest, selectedSpread]);

  const retryHistorySync = useCallback(async () => {
    if (identityKey === "guest") return true;
    const accountId = identityKey.slice("account:".length);
    const pending = readAccountReadingOutbox(localStorage, accountId);
    if (pending.length === 0) {
      setHistorySyncError(null);
      return true;
    }
    const retryRequest = identityLifecycleRef.current.begin(identityKey);
    try {
      for (const entry of pending) {
        if (!isCurrentIdentityRequest(retryRequest)) return false;
        const response = await fetch("/api/readings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
          signal: retryRequest.signal,
        });
        if (!isCurrentIdentityRequest(retryRequest)) return false;
        if (!response.ok) {
          setHistorySyncError("账号历史同步失败，记录仍保存在此浏览器的待同步队列中。");
          return false;
        }
        await removeAccountReadingFromOutbox(
          localStorage,
          accountId,
          entry.id,
          undefined,
          () => isCurrentIdentityRequest(retryRequest),
        );
        if (!isCurrentIdentityRequest(retryRequest)) return false;
      }
      setHistorySyncError(null);
      return true;
    } catch {
      if (isCurrentIdentityRequest(retryRequest)) {
        setHistorySyncError("账号历史同步失败，记录仍保存在此浏览器的待同步队列中。");
      }
      return false;
    } finally {
      retryRequest.finish();
    }
  }, [identityKey, isCurrentIdentityRequest]);

  const clearGeneratedState = () => {
    interpretSignatureRef.current = null;
    initialRequestIdRef.current = null;
    finalRequestIdentityRef.current = null;
    activeThreadIdRef.current = null;
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
    activeThreadIdRef.current =
      continuitySource?.threadId ?? crypto.randomUUID();
    return true;
  };

  const startDailyRitual = (dailyQuestion: string, spreadId: string) => {
    const spread = findSpreadById(spreadId);
    if (!spread || !dailyQuestion.trim()) {
      return false;
    }
    setQuestionState(dailyQuestion.trim());
    setSelectedSpreadState(spread);
    setAgentProfileState(DEFAULT_AGENT_PROFILE);
    setDrawSourceState(DEFAULT_DRAW_SOURCE);
    setContinuitySource(null);
    clearGeneratedState();
    activeThreadIdRef.current = crypto.randomUUID();
    return true;
  };

  const completeRitual = (cards: DrawnCard[]) => {
    interpretSignatureRef.current = null;
    initialRequestIdRef.current = createReadingRequestId();
    activeThreadIdRef.current ??= continuitySource?.threadId ?? crypto.randomUUID();
    finalRequestIdentityRef.current = null;
    setDrawnCards(cards);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const interpretReading = useCallback(async () => {
    if (
      (interpretInFlightRef.current && isCurrentIdentityRequest(interpretInFlightRef.current)) ||
      (!question.trim() && !isQuestionlessQuickReading) ||
      !selectedSpread ||
      drawnCards.length === 0
    ) {
      return false;
    }

    const requestDrawnCards = toRequestDrawnCards(drawnCards);
    const requestId = initialRequestIdRef.current ?? createReadingRequestId();
    initialRequestIdRef.current = requestId;
    const requestSignature = JSON.stringify({
      request_id: requestId,
      question: question.trim(),
      spreadId: selectedSpread.id,
      drawnCards: requestDrawnCards,
      agent_profile: agentProfile,
      phase: "initial",
      draw_source: drawSource,
      thread_id: activeThreadIdRef.current,
      prior_session_capsule: continuitySource?.capsule ?? null,
    });

    if (interpretSignatureRef.current === requestSignature) {
      return false;
    }

    const identityRequest = identityLifecycleRef.current.begin(identityKey);
    interpretInFlightRef.current = identityRequest;
    setIsLoading(true);
    setErrorMessage(null);
    setSafetyIntercept(null);
    interpretSignatureRef.current = requestSignature;

    try {
      const { response, payload } = await fetchJsonWithTimeout<
        StructuredReading | ReadingErrorPayload
      >("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: requestId,
          question,
          spreadId: selectedSpread.id,
          drawnCards: requestDrawnCards,
          agent_profile: agentProfile,
          phase: "initial",
          draw_source: drawSource,
          thread_id: activeThreadIdRef.current,
          prior_session_capsule: continuitySource?.capsule ?? null,
        }),
        timeoutMs: READING_REQUEST_TIMEOUT_MS,
        timeoutMessage: READING_REQUEST_TIMEOUT_MESSAGE,
        signal: identityRequest.signal,
      });

      if (!isCurrentIdentityRequest(identityRequest)) return false;

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
      clearActiveReadingDraft();

      if (!nextReading.requires_followup) {
        void persistCompletedReading(nextReading, identityRequest);
        if (isCurrentIdentityRequest(identityRequest)) {
          trackGrowthReadingCompleted(nextReading.reading_id);
        }
      }

      return true;
    } catch (error) {
      if (!isCurrentIdentityRequest(identityRequest)) return false;
      interpretSignatureRef.current = null;
      setReading(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "连接星辰时发生了偏移，请稍后再试。",
      );
      return false;
    } finally {
      if (
        interpretInFlightRef.current === identityRequest
        && isCurrentIdentityRequest(identityRequest)
      ) {
        setIsLoading(false);
        interpretInFlightRef.current = null;
      }
      identityRequest.finish();
    }
  }, [agentProfile, continuitySource, drawSource, drawnCards, identityKey, isCurrentIdentityRequest, isQuestionlessQuickReading, persistCompletedReading, question, selectedSpread]);

  const submitFollowupAnswers = useCallback(async (answers: FollowupAnswer[]) => {
    if (
      (interpretInFlightRef.current && isCurrentIdentityRequest(interpretInFlightRef.current)) ||
      !question.trim() ||
      !selectedSpread ||
      drawnCards.length === 0 ||
      !reading ||
      reading.reading_phase !== "initial"
    ) {
      return false;
    }

    const requestDrawnCards = toRequestDrawnCards(drawnCards);
    const initialReading = normalizeReadingAgentProfile(reading);
    const requestSignature = JSON.stringify({
      question: question.trim(),
      spreadId: selectedSpread.id,
      drawnCards: requestDrawnCards,
      agent_profile: initialReading.agent_profile,
      phase: "final",
      draw_source: drawSource,
      thread_id: activeThreadIdRef.current,
      initial_reading_id: initialReading.reading_id,
      followup_answers: answers,
      prior_session_capsule: continuitySource?.capsule ?? null,
    });

    const requestId = finalRequestIdentityRef.current?.signature === requestSignature
      ? finalRequestIdentityRef.current.requestId
      : createReadingRequestId();
    finalRequestIdentityRef.current = { signature: requestSignature, requestId };

    if (interpretSignatureRef.current === requestSignature) {
      return false;
    }

    const identityRequest = identityLifecycleRef.current.begin(identityKey);
    interpretInFlightRef.current = identityRequest;
    setIsLoading(true);
    setErrorMessage(null);
    setSafetyIntercept(null);
    interpretSignatureRef.current = requestSignature;

    try {
      const { response, payload } = await fetchJsonWithTimeout<
        StructuredReading | ReadingErrorPayload
      >("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: requestId,
          question,
          spreadId: selectedSpread.id,
          drawnCards: requestDrawnCards,
          agent_profile: initialReading.agent_profile,
          phase: "final",
          draw_source: drawSource,
          thread_id: activeThreadIdRef.current,
          prior_session_capsule: continuitySource?.capsule ?? null,
          initial_reading_id: initialReading.reading_id,
          followup_answers: answers,
        }),
        timeoutMs: READING_REQUEST_TIMEOUT_MS,
        timeoutMessage: READING_REQUEST_TIMEOUT_MESSAGE,
        signal: identityRequest.signal,
      });

      if (!isCurrentIdentityRequest(identityRequest)) return false;

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
      clearActiveReadingDraft();

      if (nextReading.sober_check && wasSoberUnlocked) {
        setSoberGate({
          readingId: nextReading.reading_id,
          input: soberGate.input,
          isPassed: true,
        });
      }

      void persistCompletedReading(nextReading, identityRequest);
      if (isCurrentIdentityRequest(identityRequest)) {
        trackGrowthReadingCompleted(nextReading.reading_id);
      }
      return true;
    } catch (error) {
      if (!isCurrentIdentityRequest(identityRequest)) return false;
      interpretSignatureRef.current = null;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "连接星辰时发生了偏移，请稍后再试。",
      );
      return false;
    } finally {
      if (
        interpretInFlightRef.current === identityRequest
        && isCurrentIdentityRequest(identityRequest)
      ) {
        setIsLoading(false);
        interpretInFlightRef.current = null;
      }
      identityRequest.finish();
    }
  }, [continuitySource, drawSource, drawnCards, identityKey, isCurrentIdentityRequest, persistCompletedReading, question, reading, selectedSpread, soberGate.input, soberGate.isPassed, soberGate.readingId]);

  const selectHistoryReading = (historyEntry: ReadingHistoryEntry) => {
    interpretSignatureRef.current = null;
    initialRequestIdRef.current = null;
    finalRequestIdentityRef.current = null;
    const canonicalEntry = normalizeHistoryEntry(historyEntry);
    activeThreadIdRef.current = canonicalEntry.threadId ?? null;
    const spread = findSpreadById(canonicalEntry.spreadId) ?? null;
    const reconstructedCards: DrawnCard[] = canonicalEntry.drawnCards
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

    setQuestionState(canonicalEntry.reading.question);
    setSelectedSpreadState(spread);
    setAgentProfileState(canonicalEntry.reading.agent_profile);
    setDrawSourceState(canonicalEntry.drawSource ?? DEFAULT_DRAW_SOURCE);
    setDrawnCards(reconstructedCards);
    setReading(canonicalEntry.reading);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const continueFromHistoryReading = (historyEntry: ReadingHistoryEntry) => {
    const canonicalEntry = normalizeHistoryEntry(historyEntry);
    const nextContinuitySource = buildContinuitySource(canonicalEntry);

    if (!nextContinuitySource) {
      return false;
    }

    interpretSignatureRef.current = null;
    initialRequestIdRef.current = null;
    finalRequestIdentityRef.current = null;
    activeThreadIdRef.current = nextContinuitySource.threadId;
    setQuestionState("");
    setSelectedSpreadState(DEFAULT_SPREAD);
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

  const clearContinuityMemory = async () => {
    const threadId = continuitySource?.threadId;
    if (!threadId) {
      return true;
    }
    const identityRequest = identityLifecycleRef.current.begin(identityKey);
    try {
      const response = await fetch(
        `/api/reading/threads/${encodeURIComponent(threadId)}`,
        { method: "DELETE", signal: identityRequest.signal },
      );
      return isCurrentIdentityRequest(identityRequest) && response.ok;
    } catch {
      return false;
    } finally {
      identityRequest.finish();
    }
  };

  const resetReading = () => {
    interpretSignatureRef.current = null;
    initialRequestIdRef.current = null;
    finalRequestIdentityRef.current = null;
    activeThreadIdRef.current = null;
    setQuestionState("");
    setSelectedSpreadState(DEFAULT_SPREAD);
    setAgentProfileState(DEFAULT_AGENT_PROFILE);
    setDrawSourceState(DEFAULT_DRAW_SOURCE);
    setDrawnCards([]);
    setReading(null);
    setErrorMessage(null);
    setSafetyIntercept(null);
    setSoberGate(EMPTY_SOBER_GATE);
    setIsLoading(false);
  };

  const updateHistoryNotes = async (id: string, notes: string) => {
    const identityRequest = identityLifecycleRef.current.begin(identityKey);
    const identity: ReadingIdentity = identityKey === "guest"
      ? { kind: "guest" }
      : { kind: "account", id: identityKey.slice("account:".length) };
    try {
      const result = await saveIdentityNotes({
        identity,
        storage: localStorage,
        fetchImplementation: fetch,
        readingId: id,
        notes,
        signal: identityRequest.signal,
        guestShouldCommit: () => isCurrentIdentityRequest(identityRequest),
      });
      if (!isCurrentIdentityRequest(identityRequest)) {
        throw new Error("Identity changed while saving notes");
      }
      if (result.status === "failed") {
        throw new Error("Failed to save notes");
      }
      if (result.history) {
        setHistory(normalizeHistoryEntries(result.history));
        return result.status;
      }
      setHistory((currentHistory) => currentHistory.map((entry) =>
        entry.id === id ? { ...entry, user_notes: notes } : entry
      ));
      return result.status;
    } finally {
      identityRequest.finish();
    }
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
        historySyncError,
        retryHistorySync,
        setQuestion,
        setSelectedSpread,
        setAgentProfile,
        setDrawSource,
        startRitual,
        startDailyRitual,
        completeRitual,
        interpretReading,
        submitFollowupAnswers,
        selectHistoryReading,
        continueFromHistoryReading,
        clearContinuitySource,
        clearContinuityMemory,
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
