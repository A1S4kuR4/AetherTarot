"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getAllSpreads } from "@aethertarot/domain-tarot";
import type { AgentProfile, DrawSource, DrawnCard, QuestionType, ReadingHistoryEntry } from "@aethertarot/shared-types";
import { drawCardsForSpread } from "@/lib/tarotDraw";
import { buildLocalQuickAnalysis, type QuickAnalysis } from "@/lib/quickAnalysis";
import { beginGrowthReadingFlow } from "@/lib/growth-attribution";
import QuickDrawOverlay from "@/components/home/QuickDrawOverlay";
import { captureBurnSnapshot } from "@/components/transition/captureBurnSnapshot";
import {
  canUsePageBurnTransition,
  getBurnIgnition,
  type BurnIgnition,
} from "@/components/transition/page-burn-transition";
import { usePageBurnTransition } from "@/components/transition/usePageBurnTransition";
import { useReading } from "@/context/ReadingContext";
import { ConfigurationPane } from "./ConfigurationPane";
import { InquiryPane } from "./InquiryPane";
import { RitualStartButton } from "./RitualStartButton";
import { trackNewReadingEvent } from "./new-reading-analytics";
import {
  getPromptBatch,
  needsDecisionBoundary,
  normalizeDecisionQuestion,
} from "./new-reading-flow";
import {
  readNewReadingQuestionDraft,
  retireLegacyNewReadingQuestionDraft,
  saveNewReadingQuestionDraft,
} from "./new-reading-question-draft";
import type { AgentProfileOption, DrawSourceOption } from "./types";

const MAJOR_DECISION_TERM_REGEX =
  /离婚|辞职|分手|退学|堕胎|卖房|买房|投资|炒股|决裂|起诉|诉讼|官司|借贷|贷款|法律|财务|理财/i;
const QUESTION_DRAFT_SAVE_DELAY_MS = 1_000;

const spreads = getAllSpreads();

const PROMPT_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "relationship", label: "感情关系" },
  { id: "career", label: "事业职场" },
  { id: "self_growth", label: "自我探索" },
  { id: "decision", label: "抉择困局" },
];

const AGENT_PROFILES: AgentProfileOption[] = [
  { id: "standard", name: "日常塔罗师", subtitle: "用自然语言理解牌面与你的处境", description: "适合大多数感情、事业和自我探索问题。", badge: "推荐" },
  { id: "sober", name: "深度塔罗师", subtitle: "从多角度深入分析复杂问题", description: "适合多牌阵、需要梳理多重因素或验证假设的议题。", badge: "深度分析" },
  { id: "lite", name: "快速塔罗师", subtitle: "快速看懂当前最值得关注的一点", description: "适合简单问题或快速抽牌。", badge: "快速体验" },
];

const DRAW_SOURCES: DrawSourceOption[] = [
  { id: "digital_random", name: "线上随机洗牌", description: "线上为你执行随机洗牌与发牌序列。" },
  { id: "offline_manual", name: "实体牌线下录入", description: "使用你的实体牌抽取，再按牌阵位置录入牌面。" },
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "关系议题",
  career: "职业议题",
  self_growth: "自我成长",
  decision: "行动选择",
  other: "综合议题",
};

function inferQuestionType(question: string): QuestionType | null {
  if (!question.trim()) return null;
  if (/关系|感情|伴侣|喜欢|爱|分手|复合|他|她|对方/.test(question)) return "relationship";
  if (/工作|职业|事业|职场|项目|升职|跳槽|辞职|创业/.test(question)) return "career";
  if (/成长|模式|内心|自我|状态|课题|情绪/.test(question)) return "self_growth";
  if (/离婚|辞职|退学|堕胎|卖房|买房|投资|炒股|决裂|决定|选择|必须|要不要/.test(question)) return "decision";
  return "other";
}

function findRecentRepeatedTheme(history: ReadingHistoryEntry[], question: string) {
  const questionType = inferQuestionType(question);
  if (!questionType || questionType === "other") return null;

  const recentMatch = history.slice(0, 6).find((entry) => entry.reading.question_type === questionType);
  return recentMatch
    ? { label: QUESTION_TYPE_LABELS[questionType], question: recentMatch.reading.question }
    : null;
}

export function NewReadingWorkspace({
  anonymousDailyReadingLimit,
}: {
  anonymousDailyReadingLimit: number;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { beginCapture, cancel: cancelPageBurn, ignite } = usePageBurnTransition();
  const {
    agentProfile, clearContinuityMemory, clearContinuitySource, completeRitual, continuitySource, drawSource,
    drawnCards, history, isHydrated, question, reading, selectedSpread, setAgentProfile, setDrawSource, setQuestion,
    setSelectedSpread, startRitual,
  } = useReading();
  const [activeCategory, setActiveCategory] = useState("all");
  const [promptBatchIndex, setPromptBatchIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingStart, setPendingStart] = useState<{
    mode: "ritual" | "quick";
    question: string;
  } | null>(null);
  const [navigationMode, setNavigationMode] = useState<"ritual" | "quick" | null>(null);
  const [confirmedDecisionQuestion, setConfirmedDecisionQuestion] = useState<string | null>(null);
  const [showDecisionGuidance, setShowDecisionGuidance] = useState(false);
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const [memoryClearMessage, setMemoryClearMessage] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"restored" | "saved" | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [isQuickDrawOverlayOpen, setIsQuickDrawOverlayOpen] = useState(false);
  const [quickDrawnCard, setQuickDrawnCard] = useState<DrawnCard | null>(null);
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);
  const restoredQuestionDraftIdentityRef = useRef<string | null>(null);
  const isQuestionDraftCommitted = useRef(false);
  const pendingIgnitionRef = useRef<BurnIgnition | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const quickButtonRef = useRef<HTMLButtonElement>(null);

  const trimmedQuestion = question.trim();
  const isNavigationPending = navigationMode !== null;
  const isMajorDecisionQuestion = MAJOR_DECISION_TERM_REGEX.test(trimmedQuestion);
  const currentPrompts = getPromptBatch(
    activeCategory as "all" | "relationship" | "career" | "self_growth" | "decision",
    promptBatchIndex,
  );
  const repeatedThemeNotice = findRecentRepeatedTheme(history, trimmedQuestion);
  const startButtonDisabled = !trimmedQuestion || !selectedSpread || isNavigationPending;
  const quickButtonDisabled = isNavigationPending;
  const startButtonLabel = navigationMode === "ritual"
    ? drawSource === "offline_manual" ? "正在进入录入..." : "正在进入仪式..."
    : drawSource === "offline_manual" ? "按住确认，进入录入 →" : "按住确认，进入抽牌 →";
  const quickButtonLabel = navigationMode === "quick" ? "正在生成轻量解读..." : "当下之镜 →";
  const draftIdentityKey = sessionStatus === "authenticated" && session?.user?.id
    ? `account:${session.user.id}`
    : "guest";

  const getQuestionDraftScope = useCallback(() => draftIdentityKey === "guest"
    ? { kind: "guest" as const, storage: window.localStorage }
    : {
        kind: "account" as const,
        storage: window.sessionStorage,
        ownerId: draftIdentityKey.slice("account:".length),
      }, [draftIdentityKey]);

  useEffect(() => {
    if (!pendingStart) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pendingIgnitionRef.current = null;
      setPendingStart(null);
      setShowDecisionGuidance(true);
      window.requestAnimationFrame(() => {
        document.getElementById("new-reading-question")?.focus();
      });
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingStart]);

  useEffect(() => {
    if (!isHydrated || sessionStatus === "loading") return;
    retireLegacyNewReadingQuestionDraft(window.localStorage);

    if (restoredQuestionDraftIdentityRef.current !== draftIdentityKey) {
      restoredQuestionDraftIdentityRef.current = draftIdentityKey;
      isQuestionDraftCommitted.current = false;
      setDraftStatus(null);

      if (!question && !reading && drawnCards.length === 0) {
        try {
          if (continuitySource) {
            saveNewReadingQuestionDraft(getQuestionDraftScope(), "");
            return;
          }

          const draft = readNewReadingQuestionDraft(getQuestionDraftScope());
          if (draft) {
            setQuestion(draft);
            window.requestAnimationFrame(() => setDraftStatus("restored"));
          }
        } catch {}
      }

      return;
    }

    if (isQuestionDraftCommitted.current) return;

    const timeoutId = window.setTimeout(() => {
      try {
        setDraftStatus(saveNewReadingQuestionDraft(getQuestionDraftScope(), question) ? "saved" : null);
      } catch {
        setDraftStatus(null);
      }
    }, QUESTION_DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [continuitySource, draftIdentityKey, drawnCards.length, getQuestionDraftScope, isHydrated, question, reading, sessionStatus, setQuestion]);

  useEffect(() => {
    const columns = columnsRef.current;
    if (!columns) return;

    const updateScrollHint = () => {
      const hasOverflow = columns.scrollHeight > columns.clientHeight;
      const isAtBottom = columns.scrollHeight - columns.scrollTop - columns.clientHeight < 4;
      setShowScrollHint(hasOverflow && !isAtBottom);
    };

    updateScrollHint();
    columns.addEventListener("scroll", updateScrollHint, { passive: true });
    window.addEventListener("resize", updateScrollHint);

    return () => {
      columns.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
    };
  }, []);

  const clearCommittedQuestionDraft = () => {
    isQuestionDraftCommitted.current = true;
    try {
      saveNewReadingQuestionDraft(getQuestionDraftScope(), "");
    } catch {}
    setDraftStatus(null);
  };

  const startRitualAndTrack = () => {
    if (!startRitual()) return false;
    beginGrowthReadingFlow();
    return true;
  };

  const startRitualDirectly = () => {
    if (!startRitualAndTrack()) return false;
    clearCommittedQuestionDraft();
    setNavigationMode("ritual");
    router.push(drawSource === "offline_manual" ? "/offline-draw" : "/ritual/draw");
    return true;
  };

  const startRitualWithBurn = async (ignition: BurnIgnition | null) => {
    if (
      drawSource !== "digital_random"
      || !ignition
      || !canUsePageBurnTransition()
    ) {
      return startRitualDirectly();
    }

    if (!beginCapture()) return false;
    setNavigationMode("ritual");
    let ritualStarted = false;

    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const snapshot = await captureBurnSnapshot();
      if (!startRitualAndTrack()) {
        cancelPageBurn();
        setNavigationMode(null);
        return false;
      }
      ritualStarted = true;
      clearCommittedQuestionDraft();
      ignite({ ignition, snapshot, targetPath: "/ritual/draw" });
      return true;
    } catch {
      cancelPageBurn();
      if (!ritualStarted && !startRitualAndTrack()) {
        setNavigationMode(null);
        return false;
      }
      if (!ritualStarted) clearCommittedQuestionDraft();
      router.push("/ritual/draw");
      return true;
    }
  };

  const openQuickDrawOverlay = () => {
    if (isQuickDrawOverlayOpen || isNavigationPending) return;

    const allSpreadsList = getAllSpreads();
    const singleSpread = allSpreadsList.find((s) => s.id === "single") ?? allSpreadsList[0];

    if (!singleSpread) return;

    const cards = drawCardsForSpread(singleSpread.positions);
    if (cards.length !== singleSpread.positions.length || !cards[0]) return;

    const card = cards[0];
    setQuickDrawnCard(card);
    setQuickAnalysis(buildLocalQuickAnalysis(card));
    setIsQuickDrawOverlayOpen(true);
  };

  const requestStart = (mode: "ritual" | "quick", ignition: BurnIgnition | null = null) => {
    if (isNavigationPending) return false;
    const eventPayload = {
      drawSource,
      profile: agentProfile,
      spreadId: selectedSpread?.id,
      startMode: mode,
    } as const;
    trackNewReadingEvent("new_reading_start_requested", eventPayload);
    const normalizedQuestion = normalizeDecisionQuestion(question);
    if (needsDecisionBoundary({
      isMajorDecisionQuestion,
      question,
      confirmedQuestion: confirmedDecisionQuestion,
    })) {
      trackNewReadingEvent("new_reading_boundary_shown", eventPayload);
      pendingIgnitionRef.current = ignition;
      setPendingStart({ mode, question: normalizedQuestion });
      return true;
    }
    if (mode === "quick") {
      openQuickDrawOverlay();
      return true;
    }
    void startRitualWithBurn(ignition);
    return true;
  };

  const startWithBurn = (button: HTMLButtonElement) => {
    if (startButtonDisabled) return;
    const ignition = getBurnIgnition(
      button.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    );
    requestStart("ritual", ignition);
  };

  const handleQuickDrawModalOpen = (trigger?: HTMLButtonElement) => {
    if (trigger) {
      quickButtonRef.current = trigger;
    }
    requestStart("quick");
  };

  const handleQuickDrawModalClose = () => {
    setIsQuickDrawOverlayOpen(false);
    setQuickDrawnCard(null);
    setQuickAnalysis(null);
  };

  const handleQuickDrawModalDeepReading = () => {
    if (!quickDrawnCard || isNavigationPending) return;

    setIsQuickDrawOverlayOpen(false);
    const allSpreadsList = getAllSpreads();
    const singleSpread = allSpreadsList.find((s) => s.id === "single") ?? allSpreadsList[0];

    if (!singleSpread) return;

    const effectiveQuestion = question.trim() || "我还不知道具体要问什么，请抽取我当下最需要看见的状态。";
    setQuestion(effectiveQuestion);
    setAgentProfile("lite");
    setDrawSource("digital_random");
    setSelectedSpread(singleSpread);
    beginGrowthReadingFlow();
    completeRitual([quickDrawnCard]);
    clearCommittedQuestionDraft();
    setNavigationMode("quick");
    router.push("/reading");
  };

  const confirmDecisionBoundary = () => {
    const pending = pendingStart;
    setPendingStart(null);
    if (!pending || isNavigationPending) return;
    setConfirmedDecisionQuestion(pending.question);
    trackNewReadingEvent("new_reading_boundary_confirmed", {
      drawSource,
      profile: agentProfile,
      spreadId: selectedSpread?.id,
      startMode: pending.mode,
    });
    if (pending.mode === "quick") {
      openQuickDrawOverlay();
      return;
    }
    void startRitualWithBurn(pendingIgnitionRef.current);
    pendingIgnitionRef.current = null;
  };

  const returnToQuestion = () => {
    pendingIgnitionRef.current = null;
    setPendingStart(null);
    setShowDecisionGuidance(true);
    window.requestAnimationFrame(() => {
      document.getElementById("new-reading-question")?.focus();
    });
  };

  return (
    <div className="new-reading-sheet">
      {continuitySource ? (
        <aside className="new-reading-continuity" aria-label="延续中的线索">
          <div>
            <strong>延续中的线索</strong>
            <span>你正在延续「{continuitySource.spreadName}」：{continuitySource.question}</span>
          </div>
          <div className="new-reading-continuity-actions">
            <button type="button" onClick={clearContinuitySource} className="new-reading-text-button">停止延续</button>
            {sessionStatus === "authenticated" ? (
              <button
                type="button"
                disabled={isClearingMemory}
                onClick={async () => {
                  setIsClearingMemory(true);
                  setMemoryClearMessage(null);
                  const cleared = await clearContinuityMemory();
                  setMemoryClearMessage(cleared ? "服务端记忆已清除；当前摘要仍可用于本次延续。" : "暂时无法清除，请稍后再试。");
                  setIsClearingMemory(false);
                }}
                className="new-reading-text-button"
              >
                {isClearingMemory ? "正在清除…" : "清除这条线的记忆"}
              </button>
            ) : null}
          </div>
          {memoryClearMessage ? <p role="status">{memoryClearMessage}</p> : null}
        </aside>
      ) : null}

      <div ref={columnsRef} className="new-reading-columns">
        <InquiryPane
          activeCategory={activeCategory}
          categories={PROMPT_CATEGORIES}
          currentPrompts={currentPrompts}
          isRefreshing={isRefreshing}
          onCategoryChange={(category) => {
            setActiveCategory(category);
            setPromptBatchIndex(0);
            trackNewReadingEvent("new_reading_category_selected", { category });
          }}
          onClearQuestion={() => {
            setQuestion("");
            setDraftStatus(null);
          }}
          onPromptSelect={(prompt) => {
            setQuestion(prompt);
            setDraftStatus(null);
            trackNewReadingEvent("new_reading_prompt_selected", { category: activeCategory });
          }}
          onQuestionChange={(nextQuestion) => {
            setQuestion(nextQuestion);
            setDraftStatus(null);
          }}
          onRefreshPrompts={() => {
            setIsRefreshing(true);
            setPromptBatchIndex((index) => index + 1);
            trackNewReadingEvent("new_reading_prompts_refreshed", { category: activeCategory });
            window.setTimeout(() => setIsRefreshing(false), 300);
          }}
          question={question}
          repeatedThemeNotice={repeatedThemeNotice}
          showDecisionGuidance={showDecisionGuidance}
          draftStatus={draftStatus}
        />
        <ConfigurationPane
          agentProfile={agentProfile}
          agentProfiles={AGENT_PROFILES}
          anonymousDailyReadingLimit={anonymousDailyReadingLimit}
          drawSource={drawSource}
          drawSources={DRAW_SOURCES}
          isNavigationPending={isNavigationPending}
          onAgentProfileSelect={(profile: AgentProfile) => {
            setAgentProfile(profile);
            trackNewReadingEvent("new_reading_profile_selected", { profile });
          }}
          onDrawSourceSelect={(source: DrawSource) => {
            setDrawSource(source);
            trackNewReadingEvent("new_reading_draw_source_selected", { drawSource: source });
          }}
          onStart={startWithBurn}
          onQuickStart={handleQuickDrawModalOpen}
          quickButtonDisabled={quickButtonDisabled}
          quickButtonLabel={quickButtonLabel}
          selectedSpread={selectedSpread}
          spreads={spreads}
          onSelect={(spread) => {
            setSelectedSpread(spread);
            trackNewReadingEvent("new_reading_spread_selected", { spreadId: spread.id });
          }}
          startButtonDisabled={startButtonDisabled}
          startButtonLabel={startButtonLabel}
        />
        <div
          className={`new-reading-scroll-hint${showScrollHint ? " new-reading-scroll-hint-visible" : ""}`}
          aria-hidden="true"
        />
      </div>

      <div className="new-reading-mobile-actions" data-testid="new-reading-mobile-actions">
        <p className="new-reading-mobile-summary">
          {selectedSpread ? `${selectedSpread.name} · ` : null}
          {AGENT_PROFILES.find((profile) => profile.id === agentProfile)?.name}
        </p>
        <RitualStartButton
          disabled={startButtonDisabled}
          label={startButtonLabel}
          onComplete={startWithBurn}
        />
        <button
          type="button"
          disabled={quickButtonDisabled}
          onClick={(event) => {
            // Safari/WebKit does not focus buttons on pointer click by default.
            // The overlay records the active trigger for focus restoration.
            event.currentTarget.focus({ preventScroll: true });
            handleQuickDrawModalOpen(event.currentTarget);
          }}
          className="new-reading-quick-button"
        >
          {quickButtonLabel}
        </button>
      </div>

      {pendingStart ? (
        <div className="new-reading-dialog-backdrop" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="new-reading-boundary-title" className="new-reading-dialog">
            <p className="new-reading-section-mark">边界提醒</p>
            <h2 id="new-reading-boundary-title">重大现实决定前的校准</h2>
            <p>检测到你的问题涉及重大现实抉择。塔罗可帮助整理感受与线索，但不能替代法律、财务、医疗或其他专业意见；现实信息与个人底线应优先。</p>
            <div className="new-reading-dialog-comparison" aria-label="两种提问方式的对照">
              <div>
                <strong>判定式</strong>
                <span>“我是不是该辞职？”</span>
              </div>
              <div>
                <strong>启发式</strong>
                <span>“在决定是否离开前，我还需要看清哪些条件与代价？”</span>
              </div>
            </div>
            <div className="new-reading-dialog-actions">
              <button type="button" autoFocus onClick={returnToQuestion} className="btn-secondary">返回修改</button>
              <button type="button" onClick={confirmDecisionBoundary} className="btn-primary">我已了解，继续解读</button>
            </div>
          </section>
        </div>
      ) : null}

      <QuickDrawOverlay
        isOpen={isQuickDrawOverlayOpen}
        drawnCard={quickDrawnCard}
        quickAnalysis={quickAnalysis}
        triggerRef={quickButtonRef}
        onClose={handleQuickDrawModalClose}
        onDeepReading={handleQuickDrawModalDeepReading}
      />
    </div>
  );
}
