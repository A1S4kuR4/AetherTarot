"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useReading } from "@/context/ReadingContext";
import { ReadingHero } from "@/components/reading/interpretation/ReadingHero";
import { CoreMessageCard } from "@/components/reading/interpretation/CoreMessageCard";
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
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-20 sm:px-6 lg:pt-24">
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              {coreQuickRead ? (
                <CoreMessageCard
                  quickRead={coreQuickRead}
                  presentationMode={reading.presentation_mode}
                />
              ) : null}

              {readingCard && drawnCard ? (
                <SingleCardAnalysisSection
                  readingCard={readingCard}
                  drawnCard={drawnCard}
                />
              ) : null}

              <SynthesisSection
                synthesis={reading.synthesis}
                presentationMode={reading.presentation_mode}
                title="此处的故事"
              />

              <GuidanceSection
                guidance={reading.reflective_guidance}
                presentationMode={reading.presentation_mode}
              />

              <BoundaryNote
                safetyNote={reading.safety_note}
                confidenceNote={reading.confidence_note}
              />

              <ReadingFooter onReset={handleResetReading} />
            </motion.div>
          )
        ) : null}
      </div>
    </main>
  );
}
