"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import { ReadingHero } from "@/components/reading/interpretation/ReadingHero";
import { CoreMessage } from "@/components/reading/interpretation/CoreMessage";
import { SynthesisSection } from "@/components/reading/interpretation/SynthesisSection";
import { GuidanceSection } from "@/components/reading/interpretation/GuidanceSection";
import { BoundaryNote } from "@/components/reading/interpretation/BoundaryNote";
import { ReadingFooter } from "@/components/reading/interpretation/ReadingFooter";
import { LoadingState } from "@/components/reading/interpretation/LoadingState";
import { ErrorState } from "@/components/reading/interpretation/ErrorState";
import { SafetyIntercept } from "@/components/reading/interpretation/SafetyIntercept";
import { SoberCheckGate } from "@/components/reading/interpretation/SoberCheckGate";
import { isQuickReadingState } from "@/lib/quickReadingFlow";
import {
  LOADING_STAGES,
  QUESTION_TYPE_LABELS,
} from "@/components/reading/interpretation/constants";
import { SingleCardAnalysisSection } from "./SingleCardAnalysisSection";
import { ReadingShareDialog } from "@/components/share/ReadingShareDialog";
import { SharePrompt } from "@/components/reading/interpretation/SharePrompt";

import { getLeadSentence, uniqueStrings } from "@/components/reading/interpretation/utils";

export default function QuickReadingView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    agentProfile,
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
    resetReading,
  } = useReading();

  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareDialogKey, setShareDialogKey] = useState(0);
  const shareTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isQuickState = isQuickReadingState({
    agentProfile,
    selectedSpread,
    drawnCards,
  });

  const activeReadingId = reading?.reading_id ?? null;
  const isSoberGateCurrent = soberGate.readingId === activeReadingId;
  const soberInput = isSoberGateCurrent ? soberGate.input : "";
  const isSoberCheckPassed = isSoberGateCurrent ? soberGate.isPassed : false;
  const isSoberInputValid = soberInput.trim().length >= 5;
  const isCompletedReading = Boolean(reading && !reading.requires_followup);

  const trustPathCard = useMemo(() => {
    if (!reading || drawnCards.length === 0) {
      return null;
    }

    const cardResult = reading.cards[0];
    const drawnCard = drawnCards[0];

    if (!cardResult || !drawnCard) {
      return null;
    }

    const keywords = (
      drawnCard.isReversed
        ? drawnCard.card.reversedKeywords
        : drawnCard.card.uprightKeywords
    ).slice(0, 3);

    return {
      ...cardResult,
      keywords,
    };
  }, [drawnCards, reading]);

  const coreQuickRead = useMemo(() => {
    if (!reading || !trustPathCard) {
      return null;
    }

    const keywordCandidates = uniqueStrings([
      ...reading.themes,
      ...trustPathCard.keywords,
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
      core: getLeadSentence(reading.synthesis, keywords),
      keywords,
      action:
        reading.reflective_guidance[0]
        ?? "先把这次解读转成一个现实中可以观察的小信号。",
      boundary:
        reading.confidence_note
        ?? "不要把综合推断当成唯一答案；它只是把牌面和你的问题暂时连接起来。",
    };
  }, [reading, selectedSpread?.name, trustPathCard]);

  const handleResetReading = () => {
    resetReading();
    router.push("/");
  };

  const openShareDialog = (trigger: HTMLButtonElement) => {
    shareTriggerRef.current = trigger;
    setShareDialogKey((k) => k + 1);
    setShowShareDialog(true);
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
      router.replace("/");
      return;
    }

    if (!isQuickState) {
      router.replace("/reading");
      return;
    }

    if (!reading && !errorMessage && !isLoading && !safetyIntercept) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    errorMessage,
    interpretReading,
    isHydrated,
    isLoading,
    isQuickState,
    reading,
    router,
    safetyIntercept,
    selectedSpread,
  ]);

  useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

	  if (!isHydrated || !isQuickState || !selectedSpread || drawnCards.length === 0) {
	    return null;
	  }

  const drawnCard = drawnCards[0];
  const readingCard = reading?.cards[0];

  return (
    <div
      id="reading-main"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 pb-20 pt-20 sm:px-6 lg:pt-24"
    >
      <a
        href="#reading-main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[100] focus-visible:inline-flex focus-visible:min-h-11 focus-visible:items-center focus-visible:rounded-lg focus-visible:border focus-visible:border-paper-border focus-visible:bg-paper-raised focus-visible:px-4 focus-visible:py-2 focus-visible:font-sans focus-visible:text-sm focus-visible:font-medium focus-visible:text-ink focus-visible:shadow-lg"
      >
        跳到解读正文
      </a>
      <div className="space-y-10">
        <ReadingHero
          phase={reading?.reading_phase ?? null}
          question={question}
          questionType={reading?.question_type ?? null}
          spreadName={selectedSpread.name}
          isOffline={drawSource === "offline_manual"}
          hideQuestion
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
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "space-y-8",
                reading.presentation_mode === "void_narrative" && "space-y-14",
                reading.presentation_mode === "sober_anchor" &&
                  "opacity-90 grayscale-[20%]",
              )}
            >
              {coreQuickRead ? (
                <CoreMessage quickRead={coreQuickRead} />
              ) : null}

              {readingCard && drawnCard ? (
                <SingleCardAnalysisSection
                  readingCard={readingCard}
                  drawnCard={drawnCard}
                />
              ) : null}

              <SynthesisSection
                synthesis={reading.synthesis}
                title="此处的故事"
              />

              <GuidanceSection guidance={reading.reflective_guidance} />

              {isCompletedReading ? (
                <SharePrompt onShare={openShareDialog} />
              ) : null}

              <BoundaryNote
                safetyNote={reading.safety_note}
                confidenceNote={reading.confidence_note}
              />

              <ReadingFooter
                onReset={handleResetReading}
                onShare={isCompletedReading ? openShareDialog : undefined}
              />

              {isCompletedReading && reading ? (
                <ReadingShareDialog
                  key={shareDialogKey}
                  reading={reading}
                  drawnCards={drawnCards}
                  open={showShareDialog}
                  returnFocusRef={shareTriggerRef}
                  onOpenChange={setShowShareDialog}
                />
              ) : null}
            </motion.div>
          )
        ) : null}
      </div>
    </div>
  );
}
