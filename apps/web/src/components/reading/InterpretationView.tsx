"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { FollowupAnswer, QuestionType } from "@aethertarot/shared-types";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  relationship: "鍏崇郴璁",
  career: "鑱屼笟璁",
  self_growth: "鑷垜鎴愰暱",
  decision: "琛屽姩閫夋嫨",
  other: "缁煎悎璁",
};

export default function InterpretationView() {
  const router = useRouter();
  const {
    question,
    selectedSpread,
    drawnCards,
    reading,
    errorMessage,
    isLoading,
    safetyIntercept,
    soberGate,
    setSoberGate,
    interpretReading,
    submitFollowupAnswers,
    history,
    updateHistoryNotes,
  } = useReading();

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [followupDraftsByReadingId, setFollowupDraftsByReadingId] = useState<Record<string, Record<number, string>>>({});

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
  const isInitialAwaitingFollowup = reading?.reading_phase === "initial" && reading.requires_followup;
  const followupQuestions = reading?.follow_up_questions ?? [];
  const activeFollowupDrafts = activeReadingId
    ? followupDraftsByReadingId[activeReadingId] ?? {}
    : {};
  const areFollowupAnswersValid =
    followupQuestions.length > 0 &&
    followupQuestions.every((_, index) => (activeFollowupDrafts[index] ?? "").trim().length >= 2);

  const handleSaveNotes = () => {
    if (!currentHistoryEntryId) {
      return;
    }

    setIsSavingNote(true);
    updateHistoryNotes(currentHistoryEntryId, notes);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      setIsSavingNote(false);
      saveTimerRef.current = null;
    }, 1200);
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

  const handleSubmitFollowup = () => {
    if (!reading || !areFollowupAnswersValid) {
      return;
    }

    const answers: FollowupAnswer[] = followupQuestions.map((prompt, index) => ({
      question: prompt,
      answer: (activeFollowupDrafts[index] ?? "").trim(),
    }));

    void submitFollowupAnswers(answers);
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

  useEffect(() => {
    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace("/ritual");
      return;
    }

    if (!reading && !errorMessage && !isLoading && !safetyIntercept) {
      void interpretReading();
    }
  }, [
    drawnCards.length,
    errorMessage,
    interpretReading,
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


  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-20 pt-24 lg:flex-row lg:px-16">
      <div className="flex-1 space-y-10" style={{ maxWidth: "760px" }}>
        <header className="space-y-5">
          <h1 className="font-serif text-4xl font-semibold text-ink md:text-5xl">
            {reading?.reading_phase === "initial" ? "鍒濇瑙ｈ" : "瑙ｈ缁撴灉"}
          </h1>
          <blockquote className="border-l-2 border-terracotta/30 py-2 pl-5 text-base italic leading-relaxed text-text-muted">
            杩欐瑙ｈ涓嶆槸鏇夸綘瀹ｅ竷缁撴灉锛岃€屾槸甯姪浣犳洿娓呮鍦扮湅瑙佹鍦ㄦ垚褰㈢殑涓婚銆佸紶鍔涗笌鍙€夋嫨鐨勫姩浣溿€?
          </blockquote>

          <div className="reading-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  浣犵殑鎻愰棶
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-ink">
                  {`"${question}"`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reading ? (
                  <span className="chip-accent text-[11px]">
                    {QUESTION_TYPE_LABELS[reading.question_type]}
                  </span>
                ) : null}
                <span className="chip-warm text-[11px]">{selectedSpread.name}</span>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-5 py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-paper-border border-t-terracotta" />
            <p className="font-serif text-lg text-text-muted">姝ｅ湪鐢熸垚瑙ｈ...</p>
          </div>
        ) : safetyIntercept ? (
          <div className="reading-card border-red-900/30 bg-red-950/10 ring-1 ring-inset ring-red-900/20">
            <div className="flex items-center gap-3 border-b border-red-900/20 pb-4">
              <span className="material-symbols-outlined text-3xl text-red-500">gavel</span>
              <h2 className="font-serif text-2xl text-red-400">鐣岄檺闃绘柇</h2>
            </div>
            <p className="mt-5 text-base leading-relaxed text-red-200">
              {safetyIntercept.reason}
            </p>
            {safetyIntercept.referral_links && safetyIntercept.referral_links.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="font-sans text-xs uppercase tracking-wider text-red-400/80">
                  鐜板疄鏀寔璧勬簮锛?
                </p>
                <div className="flex flex-col gap-2">
                  {safetyIntercept.referral_links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-red-300 underline hover:text-red-200"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8">
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="rounded-full border border-paper-border bg-paper px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-paper-raised"
              >
                绂诲紑骞惰繑鍥為椤?
              </button>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="reading-card">
            <h2 className="font-serif text-2xl text-ink">杩炴帴鍙楅樆</h2>
            <p className="mt-3 leading-relaxed text-text-body">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void interpretReading()}
              className="btn-primary mt-5"
            >
              閲嶆柊灏濊瘯
            </button>
          </div>
        ) : reading ? (
          reading.sober_check && !isSoberCheckPassed ? (
            <div className="reading-card my-16 flex flex-col items-center justify-center border-terracotta/40 bg-paper-raised/80 px-8 py-12 text-center shadow-sm">
              <span className="material-symbols-outlined mb-6 text-4xl text-terracotta">
                psychiatry
              </span>
              <h2 className="mb-4 font-serif text-2xl text-ink">
                闄嶆俯涓庢瑙?(Sober Check)
              </h2>
              <p className="mb-8 max-w-lg text-base leading-[1.8] text-text-body">
                {reading.sober_check}
              </p>
              <textarea
                value={soberInput}
                onChange={(e) => setSoberGate({ readingId: activeReadingId, input: e.target.value, isPassed: false })}
                placeholder="鎴戠殑鐪熷疄椤捐檻 / 搴曠嚎璁″垝鏄?.."
                className="h-32 w-full max-w-xl resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
              />
              <button
                type="button"
                disabled={!isSoberInputValid}
                onClick={() => setSoberGate({ readingId: activeReadingId, input: soberInput, isPassed: true })}
                className="btn-primary mt-8 w-full max-w-xs transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                纭骞惰В寮€鐗岄潰
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "space-y-8",
                reading.presentation_mode === "void_narrative" && "space-y-16 lg:px-4",
                reading.presentation_mode === "sober_anchor" && "opacity-90 grayscale-[20%]",
              )}
            >
              <section
                className={cn(
                  "relative my-16 rounded-3xl border p-8 shadow-sm",
                  reading.presentation_mode === "sober_anchor"
                    ? "border-paper-border bg-paper"
                    : "border-terracotta/15 bg-gradient-to-b from-paper-raised to-paper",
                )}
              >
                <div className="absolute left-8 top-0 flex -translate-y-1/2 items-center gap-2 rounded-full border border-paper-border bg-paper px-3 py-1 shadow-sm">
                  <span className="material-symbols-outlined text-[14px] text-terracotta/70">
                    auto_awesome
                  </span>
                  <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
                    褰撳墠姘斿€欏満
                  </span>
                </div>
                <h2 className="mt-4 text-center font-serif text-3xl text-ink">
                  鏍稿績涓婚鑱氱劍
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-text-body">
                  鍦ㄦ繁鍏ユ瘡涓€寮犵墝鐨勫叿浣撳惎绀轰箣鍓嶏紝璇峰厛鎰熷彈杩欑粍鐗屽叡鍚岀紪缁囩殑鍏ㄥ眬姘涘洿涓庢牳蹇冨紶鍔涖€?
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {reading.themes.map((theme) => (
                    <span
                      key={theme}
                      className="chip-accent border-terracotta/20 bg-terracotta/5 px-4 py-2 text-[13px] shadow-sm transition-all hover:bg-terracotta/10"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </section>

              <section className="reading-card space-y-5">
                <div>
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    閫愮墝
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">閫愮墝灞曞紑</h2>
                </div>
                <div className="space-y-5">
                  {reading.cards.map((card) => {
                    const drawnCard = drawnCards.find(
                      (item) => item.positionId === card.position_id,
                    );

                    return (
                      <motion.article
                        key={`${card.position_id}-${card.card_id}`}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="rounded-2xl border border-paper-border bg-paper p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          <div className="min-w-0 flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="chip-warm text-[10px]">{card.position}</span>
                              <span className="font-sans text-[11px] font-medium text-text-muted">
                                {card.orientation === "reversed" ? "閫嗕綅" : "姝ｄ綅"}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-serif text-xl text-ink">{card.name}</h3>
                              <p className="text-sm text-text-muted">{card.english_name}</p>
                            </div>
                            <div className="rounded-r-lg border-l-2 border-paper-border bg-paper-raised/50 py-2.5 pl-4 pr-3">
                              <p className="mb-1.5 font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted opacity-80">
                                / 鍘熷瀷濂ヤ箟
                              </p>
                              <p className="font-sans text-sm leading-relaxed text-text-body">
                                {card.position_meaning}
                              </p>
                            </div>
                            <div className="rounded-xl border border-terracotta/10 bg-terracotta/5 p-4 shadow-sm">
                              <p className="mb-2 font-sans text-[10px] font-medium uppercase tracking-wider text-terracotta opacity-80">
                                / 褰撳墠鎺ㄦ柇
                              </p>
                              <p className="font-serif text-base italic leading-[1.8] text-ink">
                                {card.interpretation}
                              </p>
                            </div>
                          </div>
                          {drawnCard ? (
                            <div className="w-full max-w-[130px] shrink-0 overflow-hidden rounded-xl border border-paper-border md:ml-4">
                              <img
                                src={drawnCard.card.imageUrl}
                                alt={drawnCard.card.name}
                                className={cn(
                                  "aspect-[1/1.7] w-full object-cover",
                                  drawnCard.isReversed && "rotate-180",
                                )}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : null}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  缁煎悎
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">缁煎悎瑙ｈ</h2>
                <p className="mt-4 text-base leading-[1.85] text-text-body">
                  {reading.synthesis}
                </p>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "void_narrative" && "border-none bg-transparent px-0 shadow-none",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  鎸囧紩
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">鍙嶆€濇寚寮?/h2>
                <ul className="mt-4 space-y-3">
                  {reading.reflective_guidance.map((guidance) => (
                    <li
                      key={guidance}
                      className={cn(
                        "flex gap-3 text-base leading-relaxed text-text-body",
                        reading.presentation_mode === "void_narrative"
                          ? "border-l-0 pl-0"
                          : "border-l-2 border-terracotta/20 pl-4",
                      )}
                    >
                      {!reading.presentation_mode || reading.presentation_mode !== "void_narrative" ? (
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/50" />
                      ) : null}
                      <span>{guidance}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className={cn(
                  "reading-card",
                  reading.presentation_mode === "void_narrative" && "border-none bg-transparent px-0 shadow-none",
                  reading.presentation_mode === "sober_anchor" && "border-paper-border bg-paper",
                )}
              >
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  寤朵几
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ink">寤朵几杩介棶</h2>
                <ul className="mt-4 space-y-3">
                  {reading.follow_up_questions.map((prompt, index) => (
                    <li
                      key={`${reading.reading_id}-followup-${index}`}
                      className="rounded-xl border border-paper-border bg-paper px-5 py-3.5 text-base leading-relaxed text-text-body"
                    >
                      {prompt}
                    </li>
                  ))}
                </ul>
              </section>


              {isInitialAwaitingFollowup ? (
                <section className="relative mt-20 space-y-12">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="h-px w-12 bg-terracotta/30" />
                    <div className="space-y-2">
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
                        瀵硅瘽涓庡悓姝?(Calibrating the Echo)
                      </p>
                      <h2 className="font-serif text-2xl text-ink">鍦ㄦ繁鍏ヤ箣鍓嶏紝璇峰厑璁告垜浠榻愮幇瀹炵殑娉㈤暱</h2>
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-text-muted">
                      杩欎簺绾跨储鏉ヨ嚜鐗岄樀闂寸殑寮犲姏瑁傞殭銆備綘鐨勫洖绛斿皢浣滀负鐜板疄鐨勯敋鐐癸紝鎸囧紩鏈€缁堟繁璇荤殑鏀舵潫鏂瑰悜銆?                    </p>
                  </div>
                  
                  <div className="mx-auto max-w-2xl space-y-16">
                    {followupQuestions.map((prompt, index) => (
                      <motion.div
                        key={`${reading.reading_id}-answer-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 }}
                        className="group space-y-6"
                      >
                        <div className="flex items-start gap-4">
                          <span className="font-serif text-lg italic text-terracotta/40">
                            {String(index + 1).padStart(2, "0")} .
                          </span>
                          <h3 className="font-serif text-xl leading-relaxed text-ink">
                            {prompt}
                          </h3>
                        </div>
                        
                        <div className="relative pl-10">
                          <textarea
                            value={activeFollowupDrafts[index] ?? ""}
                            onChange={(event) => handleFollowupChange(index, event.target.value)}
                            placeholder="鍐欎笅浣犵殑鎰熸偀鎴栫幇瀹炵粏鑺?.."
                            className="w-full resize-none border-b border-paper-border bg-transparent pb-2 font-serif text-base text-ink outline-none transition-all placeholder:text-text-placeholder focus:border-terracotta/40 focus:ring-0"
                            rows={1}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                          />
                          <div className="absolute bottom-0 left-10 h-0.5 w-0 origin-left scale-x-0 bg-terracotta/20 transition-transform duration-500 group-focus-within:scale-x-100" />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center pt-8">
                    <button
                      type="button"
                      disabled={!areFollowupAnswersValid || isLoading}
                      onClick={handleSubmitFollowup}
                      className={cn(
                        "btn-primary relative px-10 py-3.5 transition-all",
                        (!areFollowupAnswersValid || isLoading) && "cursor-not-allowed opacity-50 grayscale"
                      )}
                    >
                      {isLoading ? "姝ｅ湪缂栫粐娣辫..." : "瀹屾垚瀵归綈锛屽紑鍚暣鍚堟繁璇?}
                    </button>
                    {!areFollowupAnswersValid && !isLoading && (
                      <p className="mt-4 font-sans text-[10px] uppercase tracking-widest text-text-placeholder">
                        鈥?姣忎竴澶勮闅欓兘闇€瑕佷綘鐨勭湡瀹炲洖璁?鈥?                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              {reading.safety_note ? (
                <section className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 shadow-inner ring-1 ring-inset ring-red-900/20">
                  <div className="flex items-center gap-3 border-b border-red-900/30 pb-3">
                    <span className="material-symbols-outlined text-red-500/80">warning</span>
                    <div>
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-red-500/80">
                        杈圭晫寮哄埗澹版槑
                      </p>
                      <h2 className="mt-0.5 font-serif text-lg text-red-300">蹇呰鎻愮ず</h2>
                    </div>
                  </div>
                  <p className="mt-4 font-medium text-base leading-[1.85] text-red-200/90">
                    {reading.safety_note}
                  </p>
                </section>
              ) : null}

              {reading.confidence_note ? (
                <section className="reading-card">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                    璇存槑
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">瑙ｈ璇存槑</h2>
                  <p className="mt-4 text-base leading-[1.85] text-text-body">
                    {reading.confidence_note}
                  </p>
                </section>
              ) : null}

              {currentHistoryEntry ? (
                <section className="reading-card bg-paper-raised">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                        鍙嶆€濇墜璁?
                      </p>
                      <h2 className="mt-1 font-serif text-2xl text-ink">浣犵殑鍥炴湜涓庤瀵?/h2>
                    </div>
                    {isSavingNote && (
                      <span className="flex items-center gap-1 font-sans text-xs text-terracotta opacity-80">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        宸蹭繚瀛?
                      </span>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="闅忕潃鏃堕棿鎺ㄧЩ锛岀墝鎰忓湪鐜板疄涓槸濡備綍灞曞紑鐨勶紵鍐欎笅浣犵殑鎰熸偀..."
                    className="h-32 w-full resize-none rounded-xl border border-paper-border bg-paper p-4 font-serif text-base leading-relaxed text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNote || !notes.trim()}
                      className="rounded-full border border-paper-border bg-paper px-5 py-2 text-sm font-medium text-ink transition-all hover:bg-paper-raised disabled:opacity-50"
                    >
                      鏇存柊鎵嬭
                    </button>
                  </div>
                </section>
              ) : null}
            </motion.div>
          )
        ) : null}
      </div>

      <aside className="sticky top-24 w-full space-y-6 self-start lg:w-72">
        <div className="reading-card">
          <h4 className="mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            瑙ｈ娴佺▼
          </h4>
          <div className="space-y-3">
            {["鎻愰棶", "浠紡", "鎻ず", "瑙ｈ"].map((step, index) => (
              <div
                key={step}
                className={cn("flex items-center gap-2.5", index < 3 && "opacity-40")}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    index === 3 ? "bg-terracotta" : "bg-paper-border",
                  )}
                />
                <span
                  className={cn(
                    "font-sans text-xs",
                    index === 3 && "font-medium text-terracotta",
                  )}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="reading-card">
          <h4 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            {selectedSpread.name}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {drawnCards.map((drawnCard) => (
              <div
                key={drawnCard.positionId}
                className="group aspect-[1/1.7] overflow-hidden rounded-lg border border-paper-border transition-shadow hover:shadow-sm"
              >
                <img
                  src={drawnCard.card.imageUrl}
                  alt={drawnCard.card.name}
                  className={cn(
                    "h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.02]",
                    drawnCard.isReversed && "rotate-180",
                  )}
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-l-2 border-terracotta/25 bg-terracotta/5 p-5">
          <p className="font-serif text-sm italic leading-relaxed text-text-muted">
            鐪熺悊骞朵笉鏄寮鸿瑙勫畾鐨勭粨璁猴紝鑰屾槸浠庝綘鐨勫澧冧腑鎱㈡參娴幇鐨勬柟鍚戞劅銆?
          </p>
        </div>
      </aside>
    </main>
  );
}
