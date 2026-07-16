"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { FollowupAnswer, ReadingCardResult } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import { getSpreadExperience } from "@/lib/spreadExperience";
import { ReadingLayout } from "./interpretation/ReadingLayout";
import { ReadingHero } from "./interpretation/ReadingHero";
import { MobileReadingNav } from "./interpretation/MobileReadingNav";
import { SpreadHeroGrid } from "./interpretation/SpreadHeroGrid";
import { CoreMessageCard } from "./interpretation/CoreMessageCard";
import { EvidencePanel } from "./interpretation/EvidencePanel";
import { CardByCardSection } from "./interpretation/CardByCardSection";
import { SynthesisSection } from "./interpretation/SynthesisSection";
import { GuidanceSection } from "./interpretation/GuidanceSection";
import {
  FollowupSection,
  FollowupAnswerFormSection,
} from "./interpretation/FollowupSection";
import { BoundaryNote } from "./interpretation/BoundaryNote";
import { EnergyRadarSection } from "./interpretation/EnergyRadarSection";
import { FeedbackSection } from "./interpretation/FeedbackSection";
import { NotesSection } from "./interpretation/NotesSection";
import { ReadingSidebar } from "./interpretation/ReadingSidebar";
import { ReadingFooter } from "./interpretation/ReadingFooter";
import { LoadingState } from "./interpretation/LoadingState";
import { ErrorState } from "./interpretation/ErrorState";
import { SafetyIntercept } from "./interpretation/SafetyIntercept";
import { SoberCheckGate } from "./interpretation/SoberCheckGate";
import { ReadingShareDialog } from "@/components/share/ReadingShareDialog";
import type { FeedbackLabel } from "./interpretation/constants";
import { LOADING_STAGES } from "./interpretation/constants";
import { QUESTION_TYPE_LABELS } from "./interpretation/constants";
import { READING_NAV_ITEMS } from "./interpretation/constants";
import { getLeadSentence, uniqueStrings } from "./interpretation/utils";

interface TrustPathCard extends ReadingCardResult {
  keywords: string[];
}

export default function InterpretationView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawSource,
    drawnCards,
    reading,
    errorMessage,
    isLoading,
    isHydrated,
    safetyIntercept,
    soberGate,
    setSoberGate,
    interpretReading,
    submitFollowupAnswers,
    history,
    continuitySource,
    updateHistoryNotes,
    resetReading,
  } = useReading();

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldScrollToSynthesisRef = useRef(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [followupDraftsByReadingId, setFollowupDraftsByReadingId] = useState<
    Record<string, Record<number, string>>
  >({});
  const [feedbackLabelsByReadingId, setFeedbackLabelsByReadingId] = useState<
    Record<string, FeedbackLabel[]>
  >({});
  const [feedbackNotesByReadingId, setFeedbackNotesByReadingId] = useState<
    Record<string, string>
  >({});
  const [submittedFeedbackByReadingId, setSubmittedFeedbackByReadingId] = useState<
    Record<string, boolean>
  >({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareDialogKey, setShareDialogKey] = useState(0);

  const activeReadingId = reading?.reading_id ?? null;
  const isSoberGateCurrent = soberGate.readingId === activeReadingId;
  const soberInput = isSoberGateCurrent ? soberGate.input : "";
  const isSoberCheckPassed = isSoberGateCurrent ? soberGate.isPassed : false;

  const currentHistoryEntry = reading
    ? history.find((entry) => entry.id === reading.reading_id) ?? null
    : null;
  const currentHistoryEntryId = currentHistoryEntry?.id ?? null;
  const savedNotes = currentHistoryEntry?.user_notes ?? "";
  const notes = currentHistoryEntryId
    ? noteDrafts[currentHistoryEntryId] ?? savedNotes
    : "";
  const isSoberInputValid = soberInput.trim().length >= 5;
  const isInitialAwaitingFollowup =
    reading?.reading_phase === "initial" && reading.requires_followup;
  const followupQuestions = reading?.follow_up_questions ?? [];
  const activeFollowupDrafts = activeReadingId
    ? followupDraftsByReadingId[activeReadingId] ?? {}
    : {};
  const areFollowupAnswersValid =
    followupQuestions.length > 0 &&
    followupQuestions.every(
      (_, index) => (activeFollowupDrafts[index] ?? "").trim().length >= 2,
    );
  const spreadExperience = selectedSpread
    ? getSpreadExperience(
        selectedSpread.id,
        selectedSpread.name,
        selectedSpread.positions.map((position) => position.name),
      )
    : null;
  const isCompletedReading = Boolean(reading && !reading.requires_followup);
  const activeFeedbackLabels = activeReadingId
    ? feedbackLabelsByReadingId[activeReadingId] ?? []
    : [];
  const activeFeedbackNote = activeReadingId
    ? feedbackNotesByReadingId[activeReadingId] ?? ""
    : "";
  const hasSubmittedFeedback = activeReadingId
    ? submittedFeedbackByReadingId[activeReadingId] === true
    : false;

  const radarValues = useMemo(() => {
    let fire = 0,
      water = 0,
      air = 0,
      earth = 0,
      spirit = 0,
      chaos = 0;
    const total = drawnCards.length || 1;
    drawnCards.forEach(({ card, isReversed }) => {
      const arcana = card.arcana?.toLowerCase() || "";
      const element = card.element?.toLowerCase() || "";
      if (arcana.startsWith("major")) spirit += 1;
      else {
        if (element.includes("fire") || element.includes("wands")) fire += 1;
        if (element.includes("water") || element.includes("cups")) water += 1;
        if (element.includes("air") || element.includes("swords")) air += 1;
        if (element.includes("earth") || element.includes("pentacles"))
          earth += 1;
      }
      if (isReversed) chaos += 1;
    });
    const counts = { fire, water, air, earth, spirit, chaos };
    const peakCount = Math.max(...Object.values(counts), 1);

    return {
      fire: { count: fire, total, score: fire / peakCount },
      water: { count: water, total, score: water / peakCount },
      air: { count: air, total, score: air / peakCount },
      earth: { count: earth, total, score: earth / peakCount },
      spirit: { count: spirit, total, score: spirit / peakCount },
      chaos: { count: chaos, total, score: chaos / peakCount },
    };
  }, [drawnCards]);

  const trustPathCards = useMemo<TrustPathCard[]>(() => {
    if (!reading) {
      return [];
    }

    return reading.cards.slice(0, 3).map((card) => {
      const drawnCard = drawnCards.find(
        (item) => item.positionId === card.position_id,
      );
      const keywords = drawnCard
        ? (
            drawnCard.isReversed
              ? drawnCard.card.reversedKeywords
              : drawnCard.card.uprightKeywords
          ).slice(0, 3)
        : [];

      return {
        ...card,
        keywords,
      };
    });
  }, [drawnCards, reading]);

  const coreQuickRead = useMemo(() => {
    if (!reading) {
      return null;
    }

    const keywordCandidates = uniqueStrings([
      ...reading.themes,
      ...trustPathCards.flatMap((card) => card.keywords),
      QUESTION_TYPE_LABELS[reading.question_type],
      selectedSpread?.name ?? "",
    ]);
    const keywords = keywordCandidates.slice(0, 3);

    for (const fallback of ["留意边界", "观察现实", "保留弹性"]) {
      if (keywords.length >= 3) {
        break;
      }

      if (!keywords.includes(fallback)) {
        keywords.push(fallback);
      }
    }

    return {
      core:
        getLeadSentence(reading.synthesis, keywords)
        || `这次解读的核心落在${keywords.join("、")}。`,
      keywords,
      action:
        reading.reflective_guidance[0]
        ?? "先把这次解读转成一个现实中可以观察的小信号。",
      boundary:
        reading.confidence_note
        ?? "不要把综合推断当成唯一答案；它只是把牌面和你的问题暂时连接起来。",
    };
  }, [reading, selectedSpread?.name, trustPathCards]);

  const handleResetReading = () => {
    resetReading();
    router.push("/");
  };

  const handleSaveNotes = async () => {
    if (!currentHistoryEntryId) {
      return;
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes || trimmedNotes === savedNotes.trim()) {
      return;
    }

    setNoteSaveStatus('saving');

    try {
      await updateHistoryNotes(currentHistoryEntryId, trimmedNotes);
      setNoteSaveStatus('saved');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        setNoteSaveStatus('idle');
        saveTimerRef.current = null;
      }, 2000);
    } catch {
      setNoteSaveStatus('error');
    }
  };

  const handleFollowupChange = (index: number, value: string) => {
    if (!activeReadingId) {
      return;
    }

    setFollowupDraftsByReadingId((currentDrafts) => ({
      ...currentDrafts,
      [activeReadingId]: {
        ...(currentDrafts[activeReadingId] ?? {}),
        [index]: value,
      },
    }));
  };

  const handleSubmitFollowup = async () => {
    if (!reading || !areFollowupAnswersValid) {
      return;
    }

    const answers: FollowupAnswer[] = followupQuestions.map((prompt, index) => ({
      question: prompt,
      answer: (activeFollowupDrafts[index] ?? "").trim(),
    }));

    shouldScrollToSynthesisRef.current = true;
    const didSubmit = await submitFollowupAnswers(answers);

    if (!didSubmit) {
      shouldScrollToSynthesisRef.current = false;
    }
  };

  const handleNotesChange = (value: string) => {
    if (!currentHistoryEntryId) {
      return;
    }

    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [currentHistoryEntryId]: value,
    }));
  };

  const toggleFeedbackLabel = (value: FeedbackLabel) => {
    if (!activeReadingId || hasSubmittedFeedback) {
      return;
    }

    setFeedbackError(null);
    setFeedbackLabelsByReadingId((current) => {
      const existing = current[activeReadingId] ?? [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];

      return {
        ...current,
        [activeReadingId]: next,
      };
    });
  };

  const handleFeedbackNoteChange = (value: string) => {
    if (!activeReadingId || hasSubmittedFeedback) {
      return;
    }

    setFeedbackNotesByReadingId((current) => ({
      ...current,
      [activeReadingId]: value,
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!activeReadingId || activeFeedbackLabels.length === 0) {
      return;
    }

    setFeedbackError(null);

    try {
      const response = await fetch("/api/reading-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reading_id: activeReadingId,
          labels: activeFeedbackLabels,
          note: activeFeedbackNote.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("反馈提交失败，请稍后再试。");
      }

      setSubmittedFeedbackByReadingId((current) => ({
        ...current,
        [activeReadingId]: true,
      }));
    } catch (error) {
      setFeedbackError(
        error instanceof Error ? error.message : "反馈提交失败，请稍后再试。",
      );
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace(
        drawSource === "offline_manual" ? "/offline-draw" : "/ritual",
      );
      return;
    }

    if (!reading && !errorMessage && !isLoading && !safetyIntercept) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    drawSource,
    errorMessage,
    interpretReading,
    isHydrated,
    isLoading,
    reading,
    router,
    safetyIntercept,
    selectedSpread,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStageIndex(0);
      return;
    }

    setLoadingStageIndex(0);
    const timers = LOADING_STAGES.slice(1).map((stage, index) =>
      window.setTimeout(() => {
        setLoadingStageIndex(index + 1);
      }, stage.delayMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isLoading]);

  useEffect(() => {
    if (
      !shouldScrollToSynthesisRef.current
      || isLoading
      || reading?.reading_phase !== "final"
    ) {
      return;
    }

    const synthesisSection = document.getElementById("reading-synthesis");

    if (!synthesisSection) {
      return;
    }

    shouldScrollToSynthesisRef.current = false;
    synthesisSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, isSoberCheckPassed, reading?.reading_id, reading?.reading_phase]);

  if (!isHydrated || !selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <ReadingLayout
      sidebar={
        <ReadingSidebar
          spreadName={selectedSpread.name}
          navItems={READING_NAV_ITEMS}
        />
      }
    >
      <ReadingHero
        phase={reading?.reading_phase ?? null}
        question={question}
        questionType={reading?.question_type ?? null}
        spreadName={selectedSpread.name}
        isOffline={drawSource === "offline_manual"}
      />

      {isLoading ? (
        <LoadingState stageIndex={loadingStageIndex} />
      ) : safetyIntercept ? (
        <SafetyIntercept
          reason={safetyIntercept.reason}
          referralLinks={safetyIntercept.referral_links}
        />
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={() => void interpretReading()} />
      ) : reading ? (
        reading.sober_check && !isSoberCheckPassed ? (
          <SoberCheckGate
            prompt={reading.sober_check}
            input={soberInput}
            isValid={isSoberInputValid}
            onInputChange={(value) =>
              setSoberGate({
                readingId: activeReadingId,
                input: value,
                isPassed: false,
              })
            }
            onConfirm={() =>
              setSoberGate({
                readingId: activeReadingId,
                input: soberInput,
                isPassed: true,
              })
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "space-y-8",
              reading.presentation_mode === "void_narrative" &&
                "space-y-16 lg:px-4",
              reading.presentation_mode === "sober_anchor" &&
                "opacity-90 grayscale-[20%]",
            )}
          >
            <MobileReadingNav />

            {coreQuickRead ? (
              <CoreMessageCard
                quickRead={coreQuickRead}
                presentationMode={reading.presentation_mode}
              />
            ) : null}

            <SpreadHeroGrid
              drawnCards={drawnCards}
              positionNames={selectedSpread.positions.map(
                (position) => position.name,
              )}
            />

            <EvidencePanel
              question={question}
              reading={reading}
              spreadName={selectedSpread.name}
              trustPathCards={trustPathCards}
              spreadExperience={spreadExperience}
              continuitySource={continuitySource}
            />

            <CardByCardSection
              readingCards={reading.cards}
              drawnCards={drawnCards}
            />

            <div className="my-10 border-t border-paper-border/40" />

            <SynthesisSection
              synthesis={reading.synthesis}
              presentationMode={reading.presentation_mode}
            />

            <GuidanceSection
              guidance={reading.reflective_guidance}
              presentationMode={reading.presentation_mode}
            />

            {!isInitialAwaitingFollowup && reading.follow_up_questions.length > 0 ? (
              <FollowupSection
                readingId={reading.reading_id}
                readingPhase={reading.reading_phase}
                questions={reading.follow_up_questions}
                answers={reading.followup_answers}
                presentationMode={reading.presentation_mode}
              />
            ) : null}

            {isInitialAwaitingFollowup ? (
              <FollowupAnswerFormSection
                readingId={reading.reading_id}
                questions={followupQuestions}
                drafts={activeFollowupDrafts}
                isValid={areFollowupAnswersValid}
                isLoading={isLoading}
                onDraftChange={handleFollowupChange}
                onSubmit={() => void handleSubmitFollowup()}
              />
            ) : null}

            {isCompletedReading ? (
              <FeedbackSection
                labels={activeFeedbackLabels}
                note={activeFeedbackNote}
                isSubmitted={hasSubmittedFeedback}
                error={feedbackError}
                onToggleLabel={toggleFeedbackLabel}
                onNoteChange={handleFeedbackNoteChange}
                onSubmit={() => void handleSubmitFeedback()}
              />
            ) : null}

            {drawnCards.length > 0 ? (
              <EnergyRadarSection values={radarValues} />
            ) : null}

            {currentHistoryEntry ? (
              <NotesSection
                value={notes}
                status={noteSaveStatus}
                onChange={handleNotesChange}
                onSave={handleSaveNotes}
              />
            ) : null}

            <BoundaryNote
              safetyNote={reading.safety_note}
              confidenceNote={reading.confidence_note}
            />

            <ReadingFooter
              onReset={handleResetReading}
              onShare={
                isCompletedReading
                  ? () => {
                      setShareDialogKey((k) => k + 1);
                      setShowShareDialog(true);
                    }
                  : undefined
              }
            />

            {isCompletedReading && reading ? (
              <ReadingShareDialog
                key={shareDialogKey}
                reading={reading}
                drawnCards={drawnCards}
                open={showShareDialog}
                onOpenChange={setShowShareDialog}
              />
            ) : null}
          </motion.div>
        )
      ) : null}
    </ReadingLayout>
  );
}
